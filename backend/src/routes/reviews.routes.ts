import { Router } from 'express';
import { prisma } from '../db/prisma';
import { requireAuth, requireCirculationStaff, AuthedRequest } from '../middleware/auth';
import { writeAudit } from '../services/audit.service';

export const reviewsRouter = Router();

reviewsRouter.get('/books/:id/reviews', requireAuth, async (req, res) => {
  const reviews = await prisma.review.findMany({
    where: { bookId: req.params.id, status: 'approved' },
    select: { id: true, rating: true, body: true, createdAt: true }, // never expose reviewer identity — brief §15
  });
  res.json(reviews);
});

// Goes to the moderation queue — never published directly, per architecture.md §15.
reviewsRouter.post('/books/:id/reviews', requireAuth, async (req: AuthedRequest, res) => {
  const { rating, body } = req.body;
  const review = await prisma.review.create({
    data: { bookId: req.params.id, userId: req.user!.id, rating, body: (body || '').slice(0, 1000), status: 'pending' },
  });
  res.status(201).json({ id: review.id, status: review.status });
});

reviewsRouter.get('/reviews/queue', requireAuth, requireCirculationStaff, async (_req, res) => {
  const pending = await prisma.review.findMany({ where: { status: 'pending' }, include: { book: true } });
  res.json(pending);
});

reviewsRouter.patch('/reviews/:id', requireAuth, requireCirculationStaff, async (req: AuthedRequest, res) => {
  const { status } = req.body; // approved | rejected | flagged | removed
  const review = await prisma.review.update({
    where: { id: req.params.id },
    data: { status, moderatedById: req.user!.id, moderatedAt: new Date() },
  });
  await writeAudit(req.user!.id, 'REVIEW_MODERATED', 'Review', review.id, { status });
  res.json(review);
});
