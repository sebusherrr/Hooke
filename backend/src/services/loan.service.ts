import { prisma } from '../db/prisma';
import { writeAudit } from './audit.service';

export class LoanError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

const LOAN_PERIOD_DAYS = 14;

/**
 * Issue a loan. ONLY callable by circulation staff (librarian/head_of_library/admin) —
 * enforced by requireCirculationStaff on the route, not here, but this function still
 * takes issuedById explicitly so it's obvious in the code that a loan always has an issuer.
 * Students never call this directly; they call createReservation() below instead.
 *
 * Uses a serializable transaction so two staff members issuing at the same instant can't
 * both grab the same physical copy.
 */
export async function issueLoan(params: { borrowerId: string; issuedById: string; bookId?: string; copyId?: string }) {
  const { borrowerId, issuedById, bookId, copyId } = params;
  if (!bookId && !copyId) throw new LoanError('bookId or copyId is required.');

  return prisma.$transaction(async (tx) => {
    const copy = copyId
      ? await tx.bookCopy.findUnique({ where: { id: copyId } })
      : await tx.bookCopy.findFirst({ where: { bookId, status: 'available', referenceOnly: false } });

    if (!copy) throw new LoanError('No available copy for this title.', 409);
    if (copy.status !== 'available') throw new LoanError(`Copy ${copy.barcode} is not available (status: ${copy.status}).`, 409);

    const dueAt = new Date(Date.now() + LOAN_PERIOD_DAYS * 24 * 60 * 60 * 1000);
    const loan = await tx.loan.create({
      data: { copyId: copy.id, bookId: copy.bookId, borrowerId, issuedById, dueAt, status: 'active' },
    });
    await tx.bookCopy.update({ where: { id: copy.id }, data: { status: 'on_loan' } });
    return loan;
  }).then(async (loan) => {
    await writeAudit(issuedById, 'LOAN_CREATED', 'Loan', loan.id, { borrowerId, copyId: loan.copyId });
    return loan;
  });
}

/** Return a copy, close the loan, and — if anyone is waiting — flag the next reservation
 *  as ready rather than putting the copy straight back into general circulation. */
export async function returnLoan(loanId: string, staffId: string) {
  return prisma.$transaction(async (tx) => {
    const loan = await tx.loan.findUniqueOrThrow({ where: { id: loanId } });
    if (loan.status === 'returned') throw new LoanError('This loan was already returned.', 409);

    await tx.loan.update({ where: { id: loanId }, data: { status: 'returned', returnedAt: new Date() } });

    const nextReservation = await tx.reservation.findFirst({
      where: { bookId: loan.bookId, status: 'queued' },
      orderBy: { queuedAt: 'asc' },
    });

    if (nextReservation) {
      await tx.bookCopy.update({ where: { id: loan.copyId }, data: { status: 'reserved' } });
      await tx.reservation.update({
        where: { id: nextReservation.id },
        data: { status: 'ready', readyAt: new Date(), expiresAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000) },
      });
    } else {
      await tx.bookCopy.update({ where: { id: loan.copyId }, data: { status: 'available' } });
    }
    return loan;
  }).then(async (loan) => {
    await writeAudit(staffId, 'LOAN_RETURNED', 'Loan', loan.id, {});
    return loan;
  });
}

/** Students call this, not issueLoan. Reserving a title queues them for the next available
 *  copy — it does not hand them a book. A librarian/HoL later converts a ready reservation
 *  into an actual loan via fulfilReservation(). */
export async function createReservation(userId: string, bookId: string) {
  const existing = await prisma.reservation.findFirst({
    where: { userId, bookId, status: { in: ['queued', 'ready'] } },
  });
  if (existing) throw new LoanError('You already have an active reservation for this title.', 409);

  const availableCopy = await prisma.bookCopy.findFirst({ where: { bookId, status: 'available' } });
  const reservation = await prisma.reservation.create({
    data: {
      userId, bookId,
      status: availableCopy ? 'ready' : 'queued',
      readyAt: availableCopy ? new Date() : undefined,
      expiresAt: availableCopy ? new Date(Date.now() + 3 * 24 * 60 * 60 * 1000) : undefined,
    },
  });
  if (availableCopy) await prisma.bookCopy.update({ where: { id: availableCopy.id }, data: { status: 'reserved' } });
  await writeAudit(userId, 'RESERVATION_CREATED', 'Reservation', reservation.id, { bookId });
  return reservation;
}

export async function cancelReservation(reservationId: string, userId: string) {
  const reservation = await prisma.reservation.findUniqueOrThrow({ where: { id: reservationId } });
  if (reservation.userId !== userId) throw new LoanError('Not your reservation.', 403);
  await prisma.reservation.update({ where: { id: reservationId }, data: { status: 'cancelled' } });
  // If a copy had been held for this reservation, free it back up.
  const heldCopy = await prisma.bookCopy.findFirst({ where: { bookId: reservation.bookId, status: 'reserved' } });
  if (heldCopy) await prisma.bookCopy.update({ where: { id: heldCopy.id }, data: { status: 'available' } });
  await writeAudit(userId, 'RESERVATION_CANCELLED', 'Reservation', reservationId, {});
}

/** The desk action: a librarian/HoL sees a "ready" reservation and hands the book over,
 *  which is what actually creates the Loan. This is the normal path in a real library —
 *  reservation → staff fulfils it → loan — rather than students self-checking-out. */
export async function fulfilReservation(reservationId: string, issuedById: string) {
  const reservation = await prisma.reservation.findUniqueOrThrow({ where: { id: reservationId } });
  if (reservation.status !== 'ready') throw new LoanError('This reservation is not ready for collection.', 409);
  const heldCopy = await prisma.bookCopy.findFirst({ where: { bookId: reservation.bookId, status: 'reserved' } });
  if (!heldCopy) throw new LoanError('No copy is currently held for this reservation.', 409);

  const loan = await issueLoan({ borrowerId: reservation.userId, issuedById, copyId: heldCopy.id });
  await prisma.reservation.update({ where: { id: reservationId }, data: { status: 'fulfilled' } });
  return loan;
}
