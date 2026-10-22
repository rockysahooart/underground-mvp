// Screen (safe areas, fixed bars), TabBar, Sheet, Alert, ActionSheet and Toasts (chapter 11).
import { useEffect, useLayoutEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '../components/Icon';
import { back as routerBack, navigate, useLocation } from '../router/hashRouter';
import { dismissToast, useToasts } from '../data/ui';
import { STUDENT_TABS, TEACHER_TABS } from '../router/routes';
import type { Role } from '../data/schema';

/* ---------- Navigation context: the role root used as Back fallback ---------- */
let roleRoot = '/welcome';
export const setRoleRoot = (r: string) => {
  roleRoot = r;
};
export const goBack = () => routerBack(roleRoot);

/* ---------- Glass buttons ---------- */
export function GlassButton({ icon, label, onClick, badge, pressed }: { icon: string; label: string; onClick: () => void; badge?: boolean; pressed?: boolean }) {
  return (
    <button type="button" className="glass glass-btn" aria-label={label} onClick={onClick} aria-pressed={pressed}>
      <Icon name={icon} size={icon === 'chevron.left' || icon === 'xmark' ? 20 : 22} />
      {badge && <span className="dot-badge" aria-hidden="true" />}
    </button>
  );
}

export function GlassText({ children, onClick, strong, disabled, label }: { children: ReactNode; onClick: () => void; strong?: boolean; disabled?: boolean; label?: string }) {
  return (
    <button type="button" className={`glass glass-text${strong ? ' glass-text--strong' : ''}`} onClick={() => !disabled && onClick()} aria-disabled={disabled || undefined} aria-label={label}>
      {children}
    </button>
  );
}

/* ---------- Screen ---------- */
export interface ScreenProps {
  children: ReactNode;
  /** Document title; also the nav title when navTitle is true. */
  title: string;
  navTitle?: boolean;
  back?: boolean | (() => void);
  close?: () => void;
  trailing?: ReactNode;
  plain?: boolean;
  bottom?: ReactNode;
  bottomGlass?: boolean;
  noNav?: boolean;
  fit?: boolean;
  className?: string;
  /** The screen renders its own visible h1 (the nav title is then decorative). */
  ownHeading?: boolean;
}

export function Screen({ children, title, navTitle, back, close, trailing, plain, bottom, bottomGlass = true, noNav, fit, className, ownHeading }: ScreenProps) {
  const ref = useRef<HTMLElement>(null);
  const loc = useLocation();
  useLayoutEffect(() => {
    document.title = `${title} · Scale`;
  }, [title]);
  useEffect(() => {
    if (loc.dir !== 'back') window.scrollTo(0, 0);
    const h1 = ref.current?.querySelector('h1');
    if (h1) {
      h1.setAttribute('tabindex', '-1');
      h1.focus({ preventScroll: true });
    }
    // Focus the title once per screen mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const hasNav = !noNav && (back || close || trailing || navTitle);
  const anim = loc.dir === 'back' ? 'screen-enter-back' : loc.dir === 'fwd' ? 'screen-enter-fwd' : '';
  return (
    <>
      {hasNav && (
        <header className={`fixed-col navbar${plain ? ' navbar--plain' : ''}`}>
          <div className="navbar__lead">
            {close ? (
              <GlassButton icon="xmark" label="Close" onClick={close} />
            ) : back ? (
              <GlassButton icon="chevron.left" label="Back" onClick={typeof back === 'function' ? back : goBack} />
            ) : null}
          </div>
          <div className="navbar__title" aria-hidden={navTitle ? undefined : true}>
            {navTitle ? title : ''}
          </div>
          <div className="navbar__trail">{trailing}</div>
        </header>
      )}
      <main
        ref={ref}
        className={`screen${plain ? ' screen--plain' : ''}${hasNav ? '' : ' screen--no-nav'}${fit ? ' screen--fit' : ''} ${anim} ${className ?? ''}`}
        style={bottom ? { paddingBottom: 'calc(var(--clearance) + 60px)' } : undefined}
      >
        {navTitle && !ownHeading ? <h1 className="sr-only">{title}</h1> : null}
        {children}
      </main>
      {bottom && <div className={`fixed-col bottombar${bottomGlass ? ' glass' : ''}`} style={bottomGlass ? undefined : { background: plain ? 'var(--bg-primary)' : 'var(--bg-grouped)' }}>{bottom}</div>}
    </>
  );
}

/* ---------- Tab bar ---------- */
export function TabBar({ role, active }: { role: Role; active?: string }) {
  const tabs = role === 'student' ? STUDENT_TABS : TEACHER_TABS;
  return (
    <nav className="fixed-col tabbar glass" aria-label={role === 'student' ? 'Student tabs' : 'Teacher tabs'}>
      {tabs.map((t) => (
        <a
          key={t.key}
          href={`#${t.to}`}
          className="tabbar__item"
          aria-current={active === t.key ? 'page' : undefined}
          onClick={(e) => {
            e.preventDefault();
            navigate(t.to, { dir: 'none' });
          }}
        >
          <Icon name={t.icon} size={22} />
          <span>{t.label}</span>
        </a>
      ))}
    </nav>
  );
}

/* ---------- Focus trap ---------- */
function useFocusTrap(open: boolean, onEscape: () => void, initial?: () => HTMLElement | null) {
  const ref = useRef<HTMLDivElement>(null);
  const esc = useRef(onEscape);
  esc.current = onEscape;
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const root = ref.current;
    const focusables = () => Array.from(root?.querySelectorAll<HTMLElement>('button, [href], input, textarea, select, [tabindex]:not([tabindex="-1"])') ?? []).filter((el) => !el.hasAttribute('disabled'));
    window.setTimeout(() => (initial?.() ?? focusables()[0])?.focus(), 30);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        esc.current();
      } else if (e.key === 'Tab') {
        const list = focusables();
        if (!list.length) return;
        const first = list[0];
        const last = list[list.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
      prev?.focus?.({ preventScroll: true });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  return ref;
}

/* ---------- Sheet ---------- */
export interface SheetProps {
  open: boolean;
  title: string;
  onCancel: () => void;
  cancelLabel?: string;
  action?: { label: string; onClick: () => void; disabled?: boolean; loading?: boolean };
  large?: boolean;
  white?: boolean;
  children: ReactNode;
  hideHeader?: boolean;
}

export function Sheet({ open, title, onCancel, cancelLabel = 'Cancel', action, large, white, children, hideHeader }: SheetProps) {
  const ref = useFocusTrap(open, onCancel);
  if (!open) return null;
  return createPortal(
    <div className="overlay">
      <div className="scrim" onClick={onCancel} />
      <div ref={ref} className={`sheet${large ? ' sheet--large' : ''}${white ? ' sheet--white' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        {!hideHeader && (
          <div className="sheet__header">
            <span className="sheet__grabber" aria-hidden="true" />
            <button type="button" className="sheet__cancel" onClick={onCancel}>
              {cancelLabel}
            </button>
            <h2 className="sheet__title t-headline">{title}</h2>
            {action ? (
              <button
                type="button"
                className="sheet__action"
                aria-disabled={action.disabled || action.loading || undefined}
                aria-busy={action.loading || undefined}
                onClick={() => !action.disabled && !action.loading && action.onClick()}
              >
                {action.loading ? <span className="spinner" style={{ width: 18, height: 18, display: 'inline-block' }} /> : action.label}
              </button>
            ) : (
              <span />
            )}
          </div>
        )}
        <div className="sheet__body">{children}</div>
      </div>
    </div>,
    document.body,
  );
}

/* ---------- Alert ---------- */
export interface AlertProps {
  open: boolean;
  title: string;
  message?: ReactNode;
  cancel: { label: string; onClick: () => void; bold?: boolean };
  confirm: { label: string; onClick: () => void; destructive?: boolean; bold?: boolean; loading?: boolean };
}

export function Alert({ open, title, message, cancel, confirm }: AlertProps) {
  const ref = useFocusTrap(open, cancel.onClick, () => ref.current?.querySelector<HTMLElement>('.alert__title') ?? null);
  if (!open) return null;
  return createPortal(
    <div className="overlay">
      <div className="scrim" />
      <div className="alert-wrap" ref={ref}>
        <div className="alert" role="alertdialog" aria-modal="true" aria-labelledby="alert-title" aria-describedby={message ? 'alert-msg' : undefined}>
          <div className="alert__body">
            <h2 id="alert-title" className="alert__title" tabIndex={-1}>
              {title}
            </h2>
            {message && (
              <p id="alert-msg" className="alert__msg">
                {message}
              </p>
            )}
          </div>
          <div className="alert__actions">
            <button type="button" className={cancel.bold ? 'is-bold' : undefined} onClick={cancel.onClick}>
              {cancel.label}
            </button>
            <button type="button" className={`${confirm.destructive ? 'is-danger' : ''} ${confirm.bold ? 'is-bold' : ''}`} onClick={() => !confirm.loading && confirm.onClick()} aria-busy={confirm.loading || undefined}>
              {confirm.loading ? <span className="spinner" style={{ width: 18, height: 18, display: 'inline-block' }} /> : confirm.label}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/* ---------- Action sheet ---------- */
export function ActionSheet({ open, message, actions, onCancel }: { open: boolean; message?: string; actions: { label: string; onClick: () => void; destructive?: boolean; bold?: boolean }[]; onCancel: () => void }) {
  const ref = useFocusTrap(open, onCancel);
  if (!open) return null;
  const main = actions.filter((a) => !a.bold);
  const safe = actions.filter((a) => a.bold);
  return createPortal(
    <div className="overlay" style={{ zIndex: 55 }}>
      <div className="scrim" onClick={onCancel} />
      <div className="actionsheet" ref={ref} role="dialog" aria-modal="true" aria-label={message ?? 'Choose an action'}>
        <div className="actionsheet__group">
          {message && <p className="actionsheet__msg">{message}</p>}
          {main.map((a) => (
            <button key={a.label} type="button" className="actionsheet__btn" style={{ color: a.destructive ? 'var(--status-danger)' : undefined }} onClick={a.onClick}>
              {a.label}
            </button>
          ))}
        </div>
        {safe.map((a) => (
          <div key={a.label} className="actionsheet__group">
            <button type="button" className="actionsheet__btn semibold" onClick={a.onClick}>
              {a.label}
            </button>
          </div>
        ))}
      </div>
    </div>,
    document.body,
  );
}

/* ---------- Toasts (aria-live polite) ---------- */
export function Toasts() {
  const toasts = useToasts();
  return (
    <div className="toast-region" aria-live="polite" role="status">
      {toasts.map((t) => (
        <div key={t.id} className="toast">
          <Icon name={t.icon === 'check' ? 'checkmark.circle.fill' : t.icon === 'warning' ? 'exclamationmark.triangle.fill' : 'info.circle.fill'} size={20} />
          <span>{t.text}</span>
          {t.action && (
            <button
              type="button"
              className="toast__action"
              onClick={() => {
                t.action!.onClick();
                dismissToast(t.id);
              }}
            >
              {t.action.label}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

/* ---------- Bottom bar helpers ---------- */
export function BottomMeta({ left, right }: { left: ReactNode; right?: ReactNode }) {
  return (
    <div className="bottombar__meta">
      <span className="t-headline" style={{ fontSize: '1.06rem' }}>
        {left}
      </span>
      {right && <span className="t-subhead">{right}</span>}
    </div>
  );
}
