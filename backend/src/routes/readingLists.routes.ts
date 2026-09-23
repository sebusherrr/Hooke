import { Router } from 'express';
import { prisma } from '../db/prisma';
import { requireAuth, AuthedRequest } from '../middleware/auth';

export const readingListsRouter = Router();

readingListsRouter.get('/', requireAuth, async (req: AuthedRequest, res) => {
  // Own private lists, plus anything shared school-wide/with-class/staff-only as appropriate.
  const visibility = req.user!.role === 'student' ? ['school'] : ['school', 'staff_only'];
  const lists = await prisma.readingList.findMany({
    where: { OR: [{ ownerId: req.user!.id }, { visibility: { in: visibility } }] },
    include: { items: { include: { book: true } } },
  });
  res.json(lists);
});

readingListsRouter.post('/', requireAuth, async (req: AuthedRequest, res) => {
  const { title, description, visibility, audience } = req.body;
  if (!title) return res.status(400).json({ error: 'title is required' });
  // Only staff can create class/school-shared lists — a student can only ever make private ones.
  const allowedVisibility = req.user!.role === 'student' ? 'private' : (visibility || 'private');
  const list = await prisma.readingList.create({
    data: { ownerId: req.user!.id, title, description, visibility: allowedVisibility, audience },
  });
  res.status(201).json(list);
});

readingListsRouter.post('/:id/items', requireAuth, async (req: AuthedRequest, res) => {
  const list = await prisma.readingList.findUniqueOrThrow({ where: { id: req.params.id } });
  if (list.ownerId !== req.user!.id) return res.status(403).json({ error: 'Not your list' });
  const { bookId } = req.body;
  const item = await prisma.readingListItem.create({ data: { readingListId: list.id, bookId } });
  res.status(201).json(item);
});

readingListsRouter.delete('/:id', requireAuth, async (req: AuthedRequest, res) => {
  const list = await prisma.readingList.findUniqueOrThrow({ where: { id: req.params.id } });
  if (list.ownerId !== req.user!.id) return res.status(403).json({ error: 'Not your list' });
  await prisma.readingList.delete({ where: { id: list.id } });
  res.status(204).end();
});
