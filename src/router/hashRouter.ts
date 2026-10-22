// Hand-written hash router: routes survive a refresh on GitHub Pages (chapter 11).
// Sheets, alerts and toasts are overlay state, never history entries.
import { useSyncExternalStore } from 'react';

export interface Location {
  path: string;
  query: URLSearchParams;
  search: string;
  idx: number;
  dir: 'fwd' | 'back' | 'none';
}

function readHash(): { path: string; search: string } {
  const raw = window.location.hash.replace(/^#/, '') || '/';
  const [path, search = ''] = raw.split('?');
  return { path: path.replace(/\/+$/, '') || '/', search };
}

let idx: number = (window.history.state && typeof window.history.state.idx === 'number' ? window.history.state.idx : 0) as number;
if (!window.history.state || typeof window.history.state.idx !== 'number') {
  window.history.replaceState({ idx }, '');
}

function build(dir: Location['dir']): Location {
  const { path, search } = readHash();
  return { path, search, query: new URLSearchParams(search), idx, dir };
}

let current: Location = build('none');
const listeners = new Set<() => void>();
const emit = (dir: Location['dir']) => {
  current = build(dir);
  listeners.forEach((l) => l());
};

window.addEventListener('popstate', (e) => {
  const next = e.state && typeof e.state.idx === 'number' ? (e.state.idx as number) : idx + 1;
  const dir = next < idx ? 'back' : 'fwd';
  idx = next;
  if (!e.state || typeof e.state.idx !== 'number') window.history.replaceState({ idx }, '');
  emit(dir);
});

export function navigate(to: string, opts: { replace?: boolean; dir?: Location['dir'] } = {}) {
  const url = '#' + to;
  if (opts.replace) {
    window.history.replaceState({ idx }, '', url);
  } else {
    idx += 1;
    window.history.pushState({ idx }, '', url);
  }
  emit(opts.dir ?? (opts.replace ? 'none' : 'fwd'));
}

/** Back pops one level; with no history inside the app it goes to the fallback (role root). */
export function back(fallback: string) {
  if (idx > 0) window.history.back();
  else navigate(fallback, { replace: true, dir: 'back' });
}

export function useLocation(): Location {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => current,
  );
}

export type Params = Record<string, string>;

export function match(pattern: string, path: string): Params | null {
  const a = pattern.split('/').filter(Boolean);
  const b = path.split('/').filter(Boolean);
  if (a.length !== b.length) return null;
  const params: Params = {};
  for (let i = 0; i < a.length; i++) {
    if (a[i].startsWith(':')) params[a[i].slice(1)] = decodeURIComponent(b[i]);
    else if (a[i] !== b[i]) return null;
  }
  return params;
}
