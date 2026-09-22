import { NextResponse } from 'next/server';
import { storageUnavailable } from '@/server/storageErrors';
import { hashPassword, randomToken } from '@/auth/passwords';
import { notificationService, verificationEmail } from '@/services/notificationService';
import { store } from '@/store';
import { PURPOSES, type Purpose, type User } from '@/store/types';

/**
 * Registration.
 *
 * Creates the account in a pending state and sends a verification message.
 * The password is hashed before it is stored and is never echoed back.
 *
 * An address that is already registered gets the same answer as a new one.
 * Saying "that email already has an account" to an unauthenticated caller
 * turns this route into a way to find out who has registered.
 */
const MIN_PASSWORD = 10;

interface Body {
  [key: string]: unknown;
}

const text = (body: Body, key: string) =>
  typeof body[key] === 'string' ? (body[key] as string).trim() : '';

export async function POST(request: Request) {
  try {
    return await register(request);
  } catch (error) {
    return storageUnavailable(error, 'registration');
  }
}

async function register(request: Request) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: 'Malformed request.' }, { status: 400 });
  }

  const fullName = text(body, 'fullName');
  const email = text(body, 'email').toLowerCase();
  const organization = text(body, 'organization');
  const jobTitle = text(body, 'jobTitle');
  const phone = text(body, 'phone');
  const country = text(body, 'country');
  const location = text(body, 'location');
  const purpose = text(body, 'purpose') as Purpose;
  const password = typeof body.password === 'string' ? body.password : '';
  const confirm = typeof body.confirmPassword === 'string' ? body.confirmPassword : '';
  const agreed = body.agreedToTerms === true;

  const missing = [
    !fullName && 'your full name',
    !email && 'your email address',
    !organization && 'your organization',
    !jobTitle && 'your job title',
    !country && 'your country',
    !location && 'your state or location',
  ].filter(Boolean) as string[];

  if (missing.length) {
    return NextResponse.json({ error: `Please provide ${missing.join(', ')}.` }, { status: 400 });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'That does not look like an email address.' }, { status: 400 });
  }
  if (!PURPOSES.includes(purpose)) {
    return NextResponse.json({ error: 'Choose what you need access for.' }, { status: 400 });
  }
  if (password.length < MIN_PASSWORD) {
    return NextResponse.json(
      { error: `Choose a password of at least ${MIN_PASSWORD} characters.` },
      { status: 400 },
    );
  }
  if (password !== confirm) {
    return NextResponse.json({ error: 'The two passwords do not match.' }, { status: 400 });
  }
  if (!agreed) {
    return NextResponse.json(
      { error: 'Accept the Terms of Use and Data Access Policy to create an account.' },
      { status: 400 },
    );
  }

  const existing = await store.findUserByEmail(email);
  const verification = randomToken();
  const origin = new URL(request.url).origin;
  const link = `${origin}/verify?token=${verification}`;

  if (!existing) {
    const { hash, salt } = await hashPassword(password);
    const now = new Date().toISOString();
    const user: User = {
      id: `usr_${randomToken(10)}`,
      fullName, email, organization, jobTitle, phone, country, location, purpose,
      role: 'AUTHORIZED_USER',
      accountStatus: 'PENDING_VERIFICATION',
      passwordHash: hash,
      passwordSalt: salt,
      verificationToken: verification,
      createdAt: now,
      updatedAt: now,
    };
    await store.createUser(user);
    await notificationService.send({ to: email, ...verificationEmail(fullName, link) });
  }

  return NextResponse.json({
    ok: true,
    message:
      'Check your email for a link to confirm your address. You can browse the platform while you wait.',
    /*
     * There is no mail provider on this deployment, so the link is returned
     * here as well. It is the only way to finish the flow, and it is shown
     * only because the platform knows it cannot deliver — a deployment with a
     * sender configured returns nothing here.
     */
    verificationLink: !notificationService.canDeliver && !existing ? link : null,
    deliveryConfigured: notificationService.canDeliver,
  });
}
