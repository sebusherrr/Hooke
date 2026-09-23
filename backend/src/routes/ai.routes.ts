import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { requireAuth, AuthedRequest } from '../middleware/auth';
import { chatWithLibraryAI } from '../services/ai.service';

export const aiRouter = Router();
const aiLimiter = rateLimit({ windowMs: 60_000, max: 20 }); // architecture.md §81

aiRouter.post('/chat', requireAuth, aiLimiter, async (req: AuthedRequest, res) => {
  const { message } = req.body;
  if (!message || typeof message !== 'string') return res.status(400).json({ error: 'message is required' });
  const result = await chatWithLibraryAI(message.slice(0, 500), req.user!.id);
  res.json(result);
});
