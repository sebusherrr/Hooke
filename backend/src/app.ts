import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import session from 'express-session';
import rateLimit from 'express-rate-limit';

import { authRouter } from './routes/auth.routes';
import { booksRouter } from './routes/books.routes';
import { copiesRouter } from './routes/copies.routes';
import { loansRouter, reservationsRouter } from './routes/loans.routes';
import { favouritesRouter } from './routes/favourites.routes';
import { readingListsRouter } from './routes/readingLists.routes';
import { reviewsRouter } from './routes/reviews.routes';
import { classCheckoutsRouter } from './routes/classCheckouts.routes';
import { purchaseRequestsRouter } from './routes/purchaseRequests.routes';
import { aiRouter } from './routes/ai.routes';
import { adminRouter } from './routes/admin.routes';

export function createApp() {
  const app = express();

  app.set('trust proxy', 1); // needed for secure cookies behind a real load balancer/CDN
  app.use(helmet());
  app.use(cors({ origin: process.env.ORIGIN, credentials: true }));
  app.use(express.json({ limit: '1mb' }));

  app.use(session({
    secret: process.env.SESSION_SECRET || 'dev-only-insecure-secret-CHANGE-ME',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 1000 * 60 * 60 * 8,
    },
  }));

  // Global baseline; individual routers (auth, AI) apply their own tighter limits on top.
  app.use('/api', rateLimit({ windowMs: 60_000, max: 120 }));

  app.get('/health', (_req, res) => res.json({ ok: true }));

  app.use('/api/auth', authRouter);
  app.use('/api/books', booksRouter);
  app.use('/api', copiesRouter); // mounts /api/copies/* and /api/books/:bookId/copies
  app.use('/api/loans', loansRouter);
  app.use('/api/reservations', reservationsRouter);
  app.use('/api/favourites', favouritesRouter);
  app.use('/api/reading-lists', readingListsRouter);
  app.use('/api', reviewsRouter); // mounts /api/books/:id/reviews and /api/reviews/:id
  app.use('/api/class-checkouts', classCheckoutsRouter);
  app.use('/api/purchase-requests', purchaseRequestsRouter);
  app.use('/api/ai', aiRouter);
  app.use('/api/admin', adminRouter);

  // Student-facing errors never leak stack traces/SQL/internal details — architecture.md §50.
  app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error(err);
    res.status(err.status || 500).json({ error: 'Something went wrong. Please try again.' });
  });

  return app;
}
