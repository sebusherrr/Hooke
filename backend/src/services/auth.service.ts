import bcrypt from 'bcrypt';
import { OAuth2Client } from 'google-auth-library';
import {
  generateRegistrationOptions, verifyRegistrationResponse,
  generateAuthenticationOptions, verifyAuthenticationResponse,
} from '@simplewebauthn/server';
import { prisma } from '../db/prisma';
import { writeAudit } from './audit.service';

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const WORKSPACE_DOMAIN = process.env.GOOGLE_WORKSPACE_DOMAIN || 'abingdon.org.uk';
const RP_ID = process.env.RP_ID || 'localhost';
const RP_NAME = 'Abingdon School Library';
const ORIGIN = process.env.ORIGIN || `https://${RP_ID}`;
const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);

export class AuthError extends Error {
  constructor(message: string, public status = 401) { super(message); }
}

/** Sign-up (not just sign-in): domain-restricted, always starts as `student`.
 *  Role elevation to staff/librarian/head_of_library/admin is an explicit admin action
 *  afterwards (see users.routes.ts) — nobody grants themselves admin at sign-up. */
export async function signUpWithPassword(email: string, password: string, displayName: string) {
  const normalised = email.trim().toLowerCase();
  assertSchoolDomain(normalised);
  const existing = await prisma.user.findUnique({ where: { email: normalised } });
  if (existing) throw new AuthError('An account with this email already exists.', 409);
  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({
    data: { email: normalised, passwordHash, displayName, role: 'student', authProvider: 'password' },
  });
  await writeAudit(user.id, 'USER_SIGNED_UP', 'User', user.id, { provider: 'password' });
  return user;
}

export async function loginWithPassword(email: string, password: string) {
  const normalised = email.trim().toLowerCase();
  const user = await prisma.user.findUnique({ where: { email: normalised } });
  if (!user?.passwordHash) throw new AuthError('Invalid credentials.');
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) throw new AuthError('Invalid credentials.');
  await writeAudit(user.id, 'USER_LOGIN', 'User', user.id, { provider: 'password' });
  return user;
}

/** Handles BOTH sign-up and sign-in: a first-time Google sign-in on an Abingdon account
 *  creates the account automatically ("sign up with Google to set up your account"),
 *  a returning one just logs in. Domain is verified server-side from the Google token,
 *  never trusted from anything the client asserts. */
export async function continueWithGoogle(idToken: string) {
  if (!GOOGLE_CLIENT_ID) throw new AuthError('Google sign-in is not configured yet.', 503);
  const ticket = await googleClient.verifyIdToken({ idToken, audience: GOOGLE_CLIENT_ID });
  const payload = ticket.getPayload();
  if (!payload?.email || !payload.email_verified) throw new AuthError('Google verification failed.');
  const email = payload.email.toLowerCase();
  assertSchoolDomain(email);

  let user = await prisma.user.findUnique({ where: { email } });
  const isNewAccount = !user;
  if (!user) {
    user = await prisma.user.create({
      data: {
        email, displayName: payload.name || email.split('@')[0],
        role: 'student', authProvider: 'google', googleSub: payload.sub,
        emailVerifiedAt: new Date(),
      },
    });
  } else if (!user.googleSub) {
    user = await prisma.user.update({ where: { id: user.id }, data: { googleSub: payload.sub } });
  }
  await writeAudit(user.id, isNewAccount ? 'USER_SIGNED_UP' : 'USER_LOGIN', 'User', user.id, { provider: 'google' });
  return { user, isNewAccount };
}

function assertSchoolDomain(email: string) {
  if (!email.endsWith('@' + WORKSPACE_DOMAIN)) {
    throw new AuthError(`Accounts are restricted to @${WORKSPACE_DOMAIN} addresses.`, 403);
  }
}

/* ---- WebAuthn passkeys ---- */
export async function passkeyRegistrationOptions(userId: string) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, include: { passkeys: true } });
  const options = await generateRegistrationOptions({
    rpName: RP_NAME, rpID: RP_ID, userID: Buffer.from(user.id), userName: user.email,
    attestationType: 'none',
    excludeCredentials: user.passkeys.map(p => ({ id: p.credentialId, type: 'public-key' })),
    authenticatorSelection: { residentKey: 'preferred', userVerification: 'preferred' },
  });
  return options; // caller stores options.challenge (e.g. in the session) for the verify step
}

export async function verifyPasskeyRegistration(userId: string, expectedChallenge: string, response: any) {
  const verification = await verifyRegistrationResponse({
    response, expectedChallenge, expectedOrigin: ORIGIN, expectedRPID: RP_ID,
  });
  if (!verification.verified || !verification.registrationInfo) throw new AuthError('Could not verify passkey.', 400);
  const { credentialID, credentialPublicKey, counter } = verification.registrationInfo;
  await prisma.passkey.create({
    data: {
      userId,
      credentialId: Buffer.from(credentialID).toString('base64url'),
      publicKey: Buffer.from(credentialPublicKey),
      counter,
    },
  });
  await writeAudit(userId, 'PASSKEY_REGISTERED', 'User', userId, {});
}

export async function passkeyAuthenticationOptions(email: string) {
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() }, include: { passkeys: true } });
  if (!user) throw new AuthError('No account found.', 404);
  const options = await generateAuthenticationOptions({
    rpID: RP_ID,
    allowCredentials: user.passkeys.map(p => ({ id: p.credentialId, type: 'public-key' })),
    userVerification: 'preferred',
  });
  return { user, options };
}

export async function verifyPasskeyLogin(userId: string, expectedChallenge: string, response: any) {
  const passkey = await prisma.passkey.findUnique({ where: { credentialId: response.id } });
  if (!passkey || passkey.userId !== userId) throw new AuthError('Unrecognised passkey.', 400);
  const verification = await verifyAuthenticationResponse({
    response, expectedChallenge, expectedOrigin: ORIGIN, expectedRPID: RP_ID,
    authenticator: { credentialID: passkey.credentialId, credentialPublicKey: passkey.publicKey, counter: passkey.counter },
  });
  if (!verification.verified) throw new AuthError('Passkey verification failed.', 401);
  await prisma.passkey.update({ where: { id: passkey.id }, data: { counter: verification.authenticationInfo.newCounter } });
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  await writeAudit(user.id, 'USER_LOGIN', 'User', user.id, { provider: 'passkey' });
  return user;
}
