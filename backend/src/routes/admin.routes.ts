import { Router } from 'express';
import { parse } from 'csv-parse/sync'; // real CSV parsing — handles quoted commas correctly, not .split(',')
import { prisma } from '../db/prisma';
import { requireAuth, requireCirculationStaff, requireSystemAdmin, AuthedRequest } from '../middleware/auth';
import { writeAudit } from '../services/audit.service';

export const adminRouter = Router();

adminRouter.get('/audit', requireAuth, requireSystemAdmin, async (_req, res) => {
  const logs = await prisma.auditLog.findMany({
    include: { actor: { select: { displayName: true, email: true } } },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });
  res.json(logs);
});

adminRouter.get('/settings', requireAuth, requireSystemAdmin, async (_req, res) => {
  const settings = await prisma.systemSetting.findMany();
  res.json(Object.fromEntries(settings.map(s => [s.key, s.value])));
});

adminRouter.patch('/settings', requireAuth, requireSystemAdmin, async (req: AuthedRequest, res) => {
  const updates = req.body as Record<string, unknown>;
  await prisma.$transaction(Object.entries(updates).map(([key, value]) =>
    prisma.systemSetting.upsert({ where: { key }, update: { value: value as any }, create: { key, value: value as any } })
  ));
  await writeAudit(req.user!.id, 'SETTINGS_CHANGED', 'SystemSetting', undefined, { keys: Object.keys(updates) });
  res.json({ ok: true });
});

// Role changes are admin-only — nobody self-elevates via sign-up. See auth.service.ts.
adminRouter.patch('/users/:id/role', requireAuth, requireSystemAdmin, async (req: AuthedRequest, res) => {
  const { role } = req.body;
  const valid = ['student', 'staff', 'librarian', 'head_of_library', 'admin'];
  if (!valid.includes(role)) return res.status(400).json({ error: 'Invalid role' });
  const user = await prisma.user.update({ where: { id: req.params.id }, data: { role } });
  await writeAudit(req.user!.id, 'USER_ROLE_CHANGED', 'User', user.id, { newRole: role });
  res.json({ id: user.id, role: user.role });
});

/** CSV import — real parsing via csv-parse (RFC 4180 compliant: quoted commas, escaped
 *  quotes, embedded newlines all handled correctly), staged as preview→confirm, never a
 *  silent overwrite. HoL only — see architecture.md's "she doesn't need CSV import" note
 *  for the Librarian role; requireSystemAdmin covers head_of_library + admin. */
adminRouter.post('/import/preview', requireAuth, requireSystemAdmin, async (req, res) => {
  try {
    const rows = parse(req.body.csv, { columns: true, skip_empty_lines: true, trim: true }) as Record<string, string>[];
    const existingIsbns = new Set((await prisma.book.findMany({ select: { isbn13: true } })).map(b => b.isbn13));
    const preview = rows.map((row) => ({
      ...row,
      _status: !row.title || !row.author ? 'invalid' : existingIsbns.has(row.isbn13) ? 'duplicate' : 'new',
    }));
    res.json({ rows: preview, summary: summarise(preview) });
  } catch (e: any) {
    res.status(400).json({ error: `Could not parse CSV: ${e.message}` });
  }
});

adminRouter.post('/import/commit', requireAuth, requireSystemAdmin, async (req: AuthedRequest, res) => {
  const rows = parse(req.body.csv, { columns: true, skip_empty_lines: true, trim: true }) as Record<string, string>[];
  let added = 0, skipped = 0, failed = 0;
  for (const row of rows) {
    if (!row.title || !row.author) { failed++; continue; }
    const exists = row.isbn13 ? await prisma.book.findUnique({ where: { isbn13: row.isbn13 } }) : null;
    if (exists) { skipped++; continue; }
    const author = (await prisma.author.findFirst({ where: { name: row.author } })) ?? await prisma.author.create({ data: { name: row.author } });
    await prisma.book.create({
      data: {
        title: row.title, isbn13: row.isbn13 || undefined, publisher: row.publisher,
        metadataSource: 'csv_import',
        authors: { create: [{ authorId: author.id }] },
      },
    });
    added++;
  }
  await writeAudit(req.user!.id, 'CATALOGUE_IMPORT', undefined, undefined, { added, skipped, failed });
  res.json({ added, skipped, failed });
});

function summarise(rows: { _status: string }[]) {
  return {
    new: rows.filter(r => r._status === 'new').length,
    duplicate: rows.filter(r => r._status === 'duplicate').length,
    invalid: rows.filter(r => r._status === 'invalid').length,
  };
}
