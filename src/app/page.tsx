import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/auth/currentUser';

/**
 * The root sends people where they can actually go: the dashboard when they
 * are signed in, the login page when they are not.
 */
export default async function HomePage() {
  const user = await getCurrentUser();
  redirect(user ? '/dashboard' : '/login');
}
