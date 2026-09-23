import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import {
  signUpWithPassword, loginWithPassword, continueWithGoogle, AuthError,
  passkeyRegistrationOptions, verifyPasskeyRegistration,
  passkeyAuthenticationOptions, verifyPasskeyLogin,
} from '../services/auth.service';
import { requireAuth, AuthedRequest } from '../middleware/auth';

export const authRouter = Router();
const authLimiter = rateLimit({ windowMs: 60_000, max: 10 }); // 10/min, per architecture.md §81

authRouter.post('/signup/password', authLimiter, async (req, res) => {
  try {
    const { email, password, displayName } = req.body;
    if (!email || !password || !displayName) return res.status(400).json({ error: 'email, password and displayName are required' });
    const user = await signUpWithPassword(email, password, displayName);
    req.session.userId = user.id;
    res.status(201).json({ role: user.role, displayName: user.displayName });
  } catch (e) { handleAuthError(e, res); }
});

authRouter.post('/login/password', authLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await loginWithPassword(email, password);
    req.session.userId = user.id;
    res.json({ role: user.role, displayName: user.displayName });
  } catch (e) { handleAuthError(e, res); }
});

// Handles sign-up AND sign-in — a first Google sign-in on an @abingdon.org.uk address
// creates the account automatically. The frontend shows "Sign up with Google to set up
// your account" precisely because this single endpoint covers both cases.
authRouter.post('/google', authLimiter, async (req, res) => {
  try {
    const { idToken } = req.body;
    const { user, isNewAccount } = await continueWithGoogle(idToken);
    req.session.userId = user.id;
    res.json({ role: user.role, displayName: user.displayName, isNewAccount });
  } catch (e) { handleAuthError(e, res); }
});

authRouter.post('/passkey/register/options', requireAuth, async (req: AuthedRequest, res) => {
  const options = await passkeyRegistrationOptions(req.user!.id);
  req.session.passkeyChallenge = options.challenge;
  res.json(options);
});
authRouter.post('/passkey/register/verify', requireAuth, async (req: AuthedRequest, res) => {
  try {
    await verifyPasskeyRegistration(req.user!.id, req.session.passkeyChallenge!, req.body);
    res.json({ verified: true });
  } catch (e) { handleAuthError(e, res); }
});
authRouter.post('/passkey/login/options', authLimiter, async (req, res) => {
  try {
    const { email } = req.body;
    const { user, options } = await passkeyAuthenticationOptions(email);
    req.session.passkeyChallenge = options.challenge;
    req.session.userId = user.id; // tentative — only confirmed once verify succeeds below
    res.json(options);
  } catch (e) { handleAuthError(e, res); }
});
authRouter.post('/passkey/login/verify', authLimiter, async (req, res) => {
  try {
    if (!req.session.userId) return res.status(400).json({ error: 'Call /passkey/login/options first.' });
    const user = await verifyPasskeyLogin(req.session.userId, req.session.passkeyChallenge!, req.body);
    res.json({ role: user.role, displayName: user.displayName });
  } catch (e) { req.session.userId = undefined; handleAuthError(e, res); }
});

authRouter.get('/me', requireAuth, (req: AuthedRequest, res) => res.json(req.user));
authRouter.post('/logout', (req, res) => req.session.destroy(() => res.json({ ok: true })));

function handleAuthError(e: unknown, res: any) {
  if (e instanceof AuthError) return res.status(e.status).json({ error: e.message });
  console.error(e);
  res.status(500).json({ error: 'Something went wrong. Please try again.' });
}
