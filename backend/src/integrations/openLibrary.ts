/**
 * Barcode → catalogue entry lookup, used when a librarian scans a book's ISBN barcode while
 * adding it to the catalogue. Open Library's Books API is public and free — no API key,
 * no school-specific credential needed — unlike Browns/VLEbooks/Amazon (see integrations/).
 * This is a real, working integration, not a mock: https://openlibrary.org/dev/docs/api/books
 */
export interface EnrichedBook {
  isbn13?: string;
  isbn10?: string;
  title: string;
  authors: string[];
  publisher?: string;
  publicationDate?: string;
  coverUrl?: string;
  description?: string;
  subjects?: string[];
  source: 'open_library';
}

export async function lookupByISBN(rawIsbn: string): Promise<EnrichedBook | null> {
  const isbn = normaliseISBN(rawIsbn);
  if (!isbn) throw new Error('That does not look like a valid ISBN.');

  const url = `https://openlibrary.org/api/books?bibkeys=ISBN:${isbn}&jscmd=data&format=json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Open Library lookup failed (${res.status}).`);
  const data = await res.json() as Record<string, any>;
  const entry = data[`ISBN:${isbn}`];
  if (!entry) return null; // not found — caller should let the librarian enter details manually

  return {
    isbn13: isbn.length === 13 ? isbn : undefined,
    isbn10: isbn.length === 10 ? isbn : undefined,
    title: entry.title,
    authors: (entry.authors || []).map((a: any) => a.name),
    publisher: entry.publishers?.[0]?.name,
    publicationDate: entry.publish_date,
    coverUrl: entry.cover?.large || entry.cover?.medium,
    description: typeof entry.notes === 'string' ? entry.notes : entry.notes?.value,
    subjects: (entry.subjects || []).map((s: any) => s.name).slice(0, 8),
    source: 'open_library',
  };
}

/** Strips hyphens/spaces and validates the ISBN-10/13 check digit — real validation,
 *  not just a length check, so a mis-scanned barcode gets rejected before it reaches
 *  Open Library or the database. */
export function normaliseISBN(raw: string): string | null {
  const cleaned = raw.replace(/[-\s]/g, '').toUpperCase();
  if (/^\d{9}[\dX]$/.test(cleaned)) return isValidISBN10(cleaned) ? cleaned : null;
  if (/^\d{13}$/.test(cleaned)) return isValidISBN13(cleaned) ? cleaned : null;
  return null;
}

function isValidISBN10(isbn: string): boolean {
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += (10 - i) * Number(isbn[i]);
  const last = isbn[9] === 'X' ? 10 : Number(isbn[9]);
  return (sum + last) % 11 === 0;
}

function isValidISBN13(isbn: string): boolean {
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += Number(isbn[i]) * (i % 2 === 0 ? 1 : 3);
  const check = (10 - (sum % 10)) % 10;
  return check === Number(isbn[12]);
}
