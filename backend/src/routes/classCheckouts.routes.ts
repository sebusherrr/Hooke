import { Router } from 'express';
import { prisma } from '../db/prisma';
import { requireAuth, requireRole, AuthedRequest } from '../middleware/auth';
import { writeAudit } from '../services/audit.service';

export const classCheckoutsRouter = Router();
const requireStaffOrAbove = requireRole('staff', 'librarian', 'head_of_library', 'admin');

classCheckoutsRouter.post('/', requireAuth, requireStaffOrAbove, async (req: AuthedRequest, res) => {
  const { className, bookId, studentNames } = req.body as { className: string; bookId: string; studentNames: string[] };
  if (!className || !bookId || !studentNames?.length) {
    return res.status(400).json({ error: 'className, bookId and studentNames are required' });
  }
  const checkout = await prisma.classCheckout.create({
    data: {
      className, bookId, issuedById: req.user!.id,
      students: { create: studentNames.map((studentName) => ({ studentName })) },
    },
    include: { students: true },
  });
  await writeAudit(req.user!.id, 'CLASS_CHECKOUT_CREATED', 'ClassCheckout', checkout.id, { className, count: studentNames.length });
  res.status(201).json(checkout);
});

// A teacher sees their own classes' checkouts; librarian/HoL see everyone's — matches the
// "what my classes are reading" scoping discussed in chat: teachers see what THEY checked
// out, not every student's individual borrowing history school-wide.
classCheckoutsRouter.get('/', requireAuth, requireStaffOrAbove, async (req: AuthedRequest, res) => {
  const isCirculationStaff = ['librarian', 'head_of_library', 'admin'].includes(req.user!.role);
  const checkouts = await prisma.classCheckout.findMany({
    where: isCirculationStaff ? {} : { issuedById: req.user!.id },
    include: { book: true, students: true },
    orderBy: { createdAt: 'desc' },
  });
  res.json(checkouts);
});
