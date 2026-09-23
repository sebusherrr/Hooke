import { Request, Response, NextFunction } from 'express';
import { prisma } from '../db/prisma';

declare module 'express-session' {
  interface SessionData { userId?: string; passkeyChallenge?: string }
}

export interface AuthedRequest extends Request {
  user?: { id: string; role: string; email: string; displayName: string };
}

/** Loads the user from the session and attaches it to req.user. The role ALWAYS comes from
 *  this lookup — never from anything the client sends in a header or body. Any handler that
 *  reads req.body.role for authorization purposes is a bug. */
export async function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const userId = req.session?.userId;
  if (!userId) return res.status(401).json({ error: 'Not authenticated' });
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) { req.session.destroy(() => {}); return res.status(401).json({ error: 'Not authenticated' }); }
  req.user = { id: user.id, role: user.role, email: user.email, displayName: user.displayName };
  next();
}

export function requireRole(...roles: string[]) {
  return (req: AuthedRequest, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
    if (!roles.includes(req.user.role)) return res.status(403).json({ error: 'Forbidden' });
    next();
  };
}

// Convenience groups matching the portal split from the frontend build:
// students reserve, staff run class checkouts, librarian/HoL run circulation,
// only HoL/admin touch integrations, AI controls, audit log, system settings.
export const requireCirculationStaff = requireRole('librarian', 'head_of_library', 'admin');
export const requireSystemAdmin = requireRole('head_of_library', 'admin');
