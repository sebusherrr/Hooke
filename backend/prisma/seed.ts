import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding development data — NOT for production use.');

  const passwordHash = await bcrypt.hash('dev-only-change-me', 12);
  const [student, staff, librarian, headOfLibrary, admin] = await Promise.all([
    prisma.user.create({ data: { email: 'dev.student@abingdon.org.uk', displayName: 'Dev Student', role: 'student', passwordHash } }),
    prisma.user.create({ data: { email: 'dev.staff@abingdon.org.uk', displayName: 'Dev Staff', role: 'staff', passwordHash } }),
    prisma.user.create({ data: { email: 'dev.librarian@abingdon.org.uk', displayName: 'Dev Librarian', role: 'librarian', passwordHash } }),
    prisma.user.create({ data: { email: 'dev.hol@abingdon.org.uk', displayName: 'Dev Head of Library', role: 'head_of_library', passwordHash } }),
    prisma.user.create({ data: { email: 'dev.admin@abingdon.org.uk', displayName: 'Dev Admin', role: 'admin', passwordHash } }),
  ]);

  const titles: { title: string; author: string; isbn13: string; genre: string; copies: number }[] = [
    { title: 'Never Let Me Go', author: 'Kazuo Ishiguro', isbn13: '9780571273188', genre: 'Literary Fiction', copies: 2 },
    { title: 'Six of Crows', author: 'Leigh Bardugo', isbn13: '9781780622286', genre: 'Fantasy', copies: 3 },
    { title: 'The Song of Achilles', author: 'Madeline Miller', isbn13: '9781408819654', genre: 'Historical Fiction', copies: 1 },
    { title: 'Sapiens', author: 'Yuval Noah Harari', isbn13: '9780099590088', genre: 'Non-Fiction', copies: 4 },
    { title: 'Circe', author: 'Madeline Miller', isbn13: '9781408890042', genre: 'Fantasy', copies: 1 },
    { title: 'The Kite Runner', author: 'Khaled Hosseini', isbn13: '9781408824863', genre: 'Fiction', copies: 2 },
    { title: 'Educated', author: 'Tara Westover', isbn13: '9781786330512', genre: 'Memoir', copies: 3 },
    { title: 'The Silent Patient', author: 'Alex Michaelides', isbn13: '9781409181637', genre: 'Mystery', copies: 2 },
    { title: 'Normal People', author: 'Sally Rooney', isbn13: '9780571334650', genre: 'Fiction', copies: 2 },
    { title: 'Piranesi', author: 'Susanna Clarke', isbn13: '9781635575637', genre: 'Fantasy', copies: 1 },
  ];

  const books = [];
  for (const t of titles) {
    const author = await prisma.author.create({ data: { name: t.author } });
    const book = await prisma.book.create({
      data: {
        title: t.title, isbn13: t.isbn13, genre: t.genre, metadataSource: 'manual',
        authors: { create: [{ authorId: author.id }] },
        copies: { create: Array.from({ length: t.copies }, (_, i) => ({
          barcode: `AB-${t.isbn13.slice(-4)}-${String(i + 1).padStart(3, '0')}`,
          status: 'available' as const,
          location: 'Main Library · Fiction',
        })) },
      },
      include: { copies: true },
    });
    books.push(book);
  }

  // A couple of active/historical loans and one reservation, so the seeded app isn't empty.
  const firstCopy = books[0].copies[0];
  await prisma.bookCopy.update({ where: { id: firstCopy.id }, data: { status: 'on_loan' } });
  await prisma.loan.create({
    data: {
      copyId: firstCopy.id, bookId: books[0].id, borrowerId: student.id, issuedById: librarian.id,
      dueAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
    },
  });

  await prisma.reservation.create({ data: { bookId: books[2].id, userId: student.id, status: 'queued' } });

  await prisma.systemSetting.createMany({
    data: [
      { key: 'ai_mode', value: 'AI_RESTRICTED' },
      { key: 'student_reviews_enabled', value: true },
      { key: 'personalised_recommendations_enabled', value: true },
    ],
  });

  console.log('Seed complete:', { users: 5, books: books.length });
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => prisma.$disconnect());
