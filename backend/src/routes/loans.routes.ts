import { Router } from 'express';
import { prisma } from '../db/prisma';
import { requireAuth, requireCirculationStaff, AuthedRequest } from '../middleware/auth';
import { issueLoan, returnLoan, createReservation, cancelReservation, fulfilReservation, LoanError } from '../services/loan.service';

export const loansRouter = Router();
export const reservationsRouter = Router();

/** Staff-only. A student's request never reaches this endpoint — the frontend for students
 *  only exposes "Reserve" (below), enforced here again server-side regardless of what the
 *  client sends, per requireCirculationStaff. */
loansRouter.post('/', requireAuth, requireCirculationStaff, async (req: AuthedRequest, res) => {
  try {
    const { borrowerId, bookId, copyId } = req.body;
    if (!borrowerId) return res.status(400).json({ error: 'borrowerId is required' });
    const loan = await issueLoan({ borrowerId, issuedById: req.user!.id, bookId, copyId });
    res.status(201).json(loan);
  } catch (e) { handleLoanError(e, res); }
});

loansRouter.get('/', requireAuth, async (req: AuthedRequest, res) => {
  const isStaffView = ['librarian', 'head_of_library', 'admin'].includes(req.user!.role);
  const loans = await prisma.loan.findMany({
    where: isStaffView ? {} : { borrowerId: req.user!.id },
    include: { book: true, copy: true, borrower: isStaffView ? { select: { id: true, displayName: true } } : false },
    orderBy: { borrowedAt: 'desc' },
  });
  res.json(loans);
});

loansRouter.post('/:id/return', requireAuth, requireCirculationStaff, async (req: AuthedRequest, res) => {
  try {
    const loan = await returnLoan(req.params.id, req.user!.id);
    res.json(loan);
  } catch (e) { handleLoanError(e, res); }
});

/* ---- Reservations: students self-serve, staff fulfil ---- */
reservationsRouter.post('/', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const { bookId } = req.body;
    if (!bookId) return res.status(400).json({ error: 'bookId is required' });
    const reservation = await createReservation(req.user!.id, bookId);
    res.status(201).json(reservation);
  } catch (e) { handleLoanError(e, res); }
});

reservationsRouter.get('/', requireAuth, async (req: AuthedRequest, res) => {
  const isStaffView = ['librarian', 'head_of_library', 'admin'].includes(req.user!.role);
  const reservations = await prisma.reservation.findMany({
    where: isStaffView ? {} : { userId: req.user!.id },
    include: { book: true, user: isStaffView ? { select: { id: true, displayName: true } } : false },
    orderBy: { queuedAt: 'asc' },
  });
  res.json(reservations);
});

reservationsRouter.delete('/:id', requireAuth, async (req: AuthedRequest, res) => {
  try {
    await cancelReservation(req.params.id, req.user!.id);
    res.status(204).end();
  } catch (e) { handleLoanError(e, res); }
});

// The desk action — converts a "ready" reservation into an actual Loan.
reservationsRouter.post('/:id/fulfil', requireAuth, requireCirculationStaff, async (req: AuthedRequest, res) => {
  try {
    const loan = await fulfilReservation(req.params.id, req.user!.id);
    res.status(201).json(loan);
  } catch (e) { handleLoanError(e, res); }
});

function handleLoanError(e: unknown, res: any) {
  if (e instanceof LoanError) return res.status(e.status).json({ error: e.message });
  console.error(e);
  res.status(500).json({ error: 'Something went wrong. Please try again.' });
}
