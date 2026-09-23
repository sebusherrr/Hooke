import { Router } from 'express';
import { prisma } from '../db/prisma';
import { requireAuth, requireCirculationStaff, AuthedRequest } from '../middleware/auth';

export const purchaseRequestsRouter = Router();

purchaseRequestsRouter.post('/', requireAuth, async (req: AuthedRequest, res) => {
  const { title, author, reason } = req.body;
  if (!title) return res.status(400).json({ error: 'title is required' });
  const request = await prisma.purchaseRequest.create({
    data: { title, author, reason, requestedById: req.user!.id },
  });
  res.status(201).json(request);
});

purchaseRequestsRouter.get('/', requireAuth, async (req: AuthedRequest, res) => {
  const isCirculationStaff = ['librarian', 'head_of_library', 'admin'].includes(req.user!.role);
  const requests = await prisma.purchaseRequest.findMany({
    where: isCirculationStaff ? {} : { requestedById: req.user!.id },
    include: { requestedBy: { select: { displayName: true } } },
    orderBy: { createdAt: 'desc' },
  });
  res.json(requests);
});

purchaseRequestsRouter.patch('/:id', requireAuth, requireCirculationStaff, async (req, res) => {
  const request = await prisma.purchaseRequest.update({ where: { id: req.params.id }, data: { status: req.body.status } });
  res.json(request);
});
