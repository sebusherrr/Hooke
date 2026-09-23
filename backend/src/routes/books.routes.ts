import { Router } from 'express';
import { prisma } from '../db/prisma';
import { requireAuth, requireCirculationStaff, AuthedRequest } from '../middleware/auth';
import { writeAudit } from '../services/audit.service';

export const booksRouter = Router();

// GET /api/books?q=tolkien&genre=Fantasy — real search, not a client-side filter.
booksRouter.get('/', requireAuth, async (req: AuthedRequest, res) => {
  const { q, genre } = req.query as { q?: string; genre?: string };
  const isStudent = req.user!.role === 'student';

  const books = await prisma.book.findMany({
    where: {
      isHidden: isStudent ? false : undefined,
      genre: genre || undefined,
      OR: q ? [
        { title: { contains: q, mode: 'insensitive' } },
        { isbn13: { contains: q } },
        { authors: { some: { author: { name: { contains: q, mode: 'insensitive' } } } } },
      ] : undefined,
    },
    include: { authors: { include: { author: true } }, copies: true },
    take: 60,
  });

  res.json(books.map(shapeBook));
});

booksRouter.get('/:id', requireAuth, async (req, res) => {
  const book = await prisma.book.findUnique({
    where: { id: req.params.id },
    include: { authors: { include: { author: true } }, copies: true, reviews: { where: { status: 'approved' } } },
  });
  if (!book) return res.status(404).json({ error: 'Not found' });
  res.json(shapeBook(book));
});

// Librarian/HoL only — students never get a write path to the catalogue.
booksRouter.post('/', requireAuth, requireCirculationStaff, async (req: AuthedRequest, res) => {
  const { title, isbn13, publisher, genre, ageRange, coverUrl, description, authorNames = [] } = req.body;
  if (!title) return res.status(400).json({ error: 'title is required' });

  const book = await prisma.book.create({
    data: {
      title, isbn13, publisher, genre, ageRange, coverUrl, description,
      metadataSource: 'manual',
      authors: {
        create: await Promise.all((authorNames as string[]).map(async (name) => {
          const existing = await prisma.author.findFirst({ where: { name } });
          const author = existing ?? await prisma.author.create({ data: { name } });
          return { authorId: author.id };
        })),
      },
    },
  });
  await writeAudit(req.user!.id, 'BOOK_CREATED', 'Book', book.id, { title });
  res.status(201).json(book);
});

booksRouter.patch('/:id', requireAuth, requireCirculationStaff, async (req: AuthedRequest, res) => {
  const book = await prisma.book.update({ where: { id: req.params.id }, data: req.body });
  await writeAudit(req.user!.id, 'BOOK_UPDATED', 'Book', book.id, {});
  res.json(book);
});

booksRouter.delete('/:id', requireAuth, requireCirculationStaff, async (req: AuthedRequest, res) => {
  await prisma.book.delete({ where: { id: req.params.id } });
  await writeAudit(req.user!.id, 'BOOK_DELETED', 'Book', req.params.id, {});
  res.status(204).end();
});

function shapeBook(book: any) {
  const availableCopies = (book.copies || []).filter((c: any) => c.status === 'available').length;
  return {
    id: book.id, title: book.title, isbn13: book.isbn13,
    authors: (book.authors || []).map((a: any) => a.author.name),
    genre: book.genre, coverUrl: book.coverUrl, description: book.description,
    isStaffPick: book.isStaffPick,
    copyCount: (book.copies || []).length,
    availableCopies,
    availability: availableCopies > 0 ? 'available' : 'unavailable', // never names a borrower — see docs/security.md
  };
}
