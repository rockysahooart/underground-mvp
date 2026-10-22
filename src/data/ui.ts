// Ephemeral UI state: toasts (aria-live) and a 1-second tick for time-based rules.
import { useEffect, useState, useSyncExternalStore } from 'react';
import { now } from './clock';

export interface Toast {
  id: number;
  text: string;
  icon?: 'info' | 'check' | 'warning';
  action?: { label: string; onClick: () => void };
  duration?: number;
}

let toasts: Toast[] = [];
const listeners = new Set<() => void>();
let n = 0;

export function toast(text: string, opts: Omit<Toast, 'id' | 'text'> = {}) {
  const t: Toast = { id: ++n, text, ...opts };
  toasts = [...toasts.slice(-2), t];
  listeners.forEach((l) => l());
  window.setTimeout(() => dismissToast(t.id), opts.duration ?? 3500);
  return t.id;
}

export function dismissToast(id: number) {
  toasts = toasts.filter((t) => t.id !== id);
  listeners.forEach((l) => l());
}

export function useToasts() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => toasts,
  );
}

export const notInPrototype = (what = 'This') => toast(`${what} is not in the prototype.`, { icon: 'info' });

/** Re-render every `ms` so countdowns and time windows stay current. */
export function useNow(ms = 1000): number {
  const [t, setT] = useState(now());
  useEffect(() => {
    const id = window.setInterval(() => setT(now()), ms);
    return () => window.clearInterval(id);
  }, [ms]);
  return t;
}

export const wait = (ms: number) => new Promise<void>((r) => window.setTimeout(r, ms));
export const latency = () => wait(300 + Math.random() * 500);
