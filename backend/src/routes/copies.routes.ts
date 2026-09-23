import { Router } from 'express';
import { prisma } from '../db/prisma';
import { requireAuth, requireCirculationStaff, AuthedRequest } from '../middleware/auth';
import { lookupByISBN, normaliseISBN } from '../integrations/openLibrary';
import { writeAudit } from '../services/audit.service';

export const copiesRouter = Router();

/** GET /api/copies/scan?isbn=9780571273188 — a librarian scans a book's ISBN barcode
 *  (with a camera, via BarcodeDetector on the frontend, or a USB scanner acting as a
 *  keyboard) and this returns catalogue-ready fields for the Add Book form to prefill.
 *  It does NOT create anything — confirming and saving is a separate, deliberate step. */
copiesRouter.get('/scan', requireAuth, requireCirculationStaff, async (req, res) => {
  const isbn = normaliseISBN(String(req.query.isbn || ''));
  if (!isbn) return res.status(400).json({ error: 'That does not look like a valid ISBN.' });

  const existingBook = await prisma.book.findUnique({ where: { isbn13: isbn.length === 13 ? isbn : undefined } });
  if (existingBook) return res.json({ alreadyInCatalogue: true, book: existingBook });

  try {
    const enriched = await lookupByISBN(isbn);
    if (!enriched) return res.json({ alreadyInCatalogue: false, found: false, isbn });
    res.json({ alreadyInCatalogue: false, found: true, ...enriched });
  } catch (e: any) {
    res.status(502).json({ error: e.message || 'Lookup failed — enter details manually.' });
  }
});

/** POST /api/books/:bookId/copies — registers a new physical copy with its own barcode
 *  (the sticker on the book itself, distinct from the ISBN). This is what a librarian
 *  scans day-to-day at the circulation desk to issue/return a specific physical item. */
copiesRouter.post('/books/:bookId/copies', requireAuth, requireCirculationStaff, async (req: AuthedRequest, res) => {
  const { barcode, location, referenceOnly } = req.body;
  if (!barcode) return res.status(400).json({ error: 'barcode is required' });
  const existing = await prisma.bookCopy.findUnique({ where: { barcode } });
  if (existing) return res.status(409).json({ error: `Barcode ${barcode} is already assigned to another copy.` });

  const copy = await prisma.bookCopy.create({
    data: { bookId: req.params.bookId, barcode, location, referenceOnly: !!referenceOnly },
  });
  await writeAudit(req.user!.id, 'COPY_CREATED', 'BookCopy', copy.id, { barcode });
  res.status(201).json(copy);
});

copiesRouter.patch('/copies/:id', requireAuth, requireCirculationStaff, async (req: AuthedRequest, res) => {
  const copy = await prisma.bookCopy.update({ where: { id: req.params.id }, data: req.body });
  await writeAudit(req.user!.id, 'COPY_UPDATED', 'BookCopy', copy.id, req.body);
  res.json(copy);
});

/** GET /api/copies/by-barcode/:barcode — the desk lookup: scan a copy's barcode to find
 *  which title/loan it belongs to, for fast return processing. */
copiesRouter.get('/copies/by-barcode/:barcode', requireAuth, requireCirculationStaff, async (req, res) => {
  const copy = await prisma.bookCopy.findUnique({
    where: { barcode: req.params.barcode },
    include: { book: true, loans: { where: { status: 'active' }, take: 1 } },
  });
  if (!copy) return res.status(404).json({ error: 'No copy found with that barcode.' });
  res.json(copy);
});
