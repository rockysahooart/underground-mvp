import { useDB } from '../data/store';
import * as sel from '../data/selectors';
import type { DB, Role, User } from '../data/schema';
import { navigate } from '../router/hashRouter';

export interface ScreenProps {
  params: Record<string, string>;
  query: URLSearchParams;
}

export function useMe(): { db: DB; me: User; role: Role } {
  const db = useDB();
  const me = sel.currentUser(db);
  // App guards guarantee a signed-in user before any role screen renders.
  return { db, me: me as User, role: (me?.activeRole ?? 'student') as Role };
}

export const go = (to: string) => navigate(to);
export const replace = (to: string) => navigate(to, { replace: true });

/** Web Share API with a copy-link fallback. */
export async function share(title: string, path: string, onCopied: () => void) {
  const url = `${window.location.origin}${window.location.pathname}#${path}`;
  try {
    if (navigator.share) {
      await navigator.share({ title, url });
      return;
    }
  } catch {
    return; // cancelled
  }
  try {
    await navigator.clipboard.writeText(url);
  } catch {
    /* clipboard can be unavailable; the toast still confirms the link */
  }
  onCopied();
}
