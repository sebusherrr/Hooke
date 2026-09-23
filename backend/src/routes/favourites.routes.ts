import { Router } from 'express';
import { prisma } from '../db/prisma';
import { requireAuth, AuthedRequest } from '../middleware/auth';

export const favouritesRouter = Router();

favouritesRouter.get('/', requireAuth, async (req: AuthedRequest, res) => {
  const favs = await prisma.favourite.findMany({ where: { userId: req.user!.id }, include: { book: true } });
  res.json(favs);
});

favouritesRouter.post('/', requireAuth, async (req: AuthedRequest, res) => {
  const { bookId } = req.body;
  if (!bookId) return res.status(400).json({ error: 'bookId is required' });
  const fav = await prisma.favourite.upsert({
    where: { userId_bookId: { userId: req.user!.id, bookId } },
    update: {},
    create: { userId: req.user!.id, bookId },
  });
  res.status(201).json(fav);
});

favouritesRouter.delete('/:bookId', requireAuth, async (req: AuthedRequest, res) => {
  await prisma.favourite.deleteMany({ where: { userId: req.user!.id, bookId: req.params.bookId } });
  res.status(204).end();
});
