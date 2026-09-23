import { PrismaClient } from '@prisma/client';

// Singleton pattern — avoids exhausting Postgres connections from hot-reload in dev.
declare global { var __prisma: PrismaClient | undefined; }
export const prisma = global.__prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== 'production') global.__prisma = prisma;
