// Components from chapter 07, with matching variant props. Screens compose these and never restyle them.
import { forwardRef, useId, useState, type ReactNode, type InputHTMLAttributes, type KeyboardEvent } from 'react';
import { Icon } from './Icon';

/* ---------- Button ---------- */
export type ButtonStyle = 'filled' | 'gray' | 'gray-elevated' | 'plain' | 'destructive';

export interface ButtonProps {
  children: ReactNode;
  variant?: ButtonStyle;
  onClick?: () => void;
  loading?: boolean;
  disabled?: boolean;
  /** Reason shown to assistive tech when disabled (the visible reason sits nearby). */
  describedBy?: string;
  small?: boolean;
  auto?: boolean;
  type?: 'button' | 'submit';
  label?: string;
  icon?: ReactNode;
}

export function Button({ children, variant = 'filled', onClick, loading, disabled, describedBy, small, auto, type = 'button', label, icon }: ButtonProps) {
  const inactive = disabled || loading;
  return (
    <button
      type={type}
      className={`btn btn--${variant}${small ? ' btn--small' : ''}${auto ? ' btn--auto' : ''}`}
      aria-disabled={disabled ? true : undefined}
      aria-busy={loading ? true : undefined}
      aria-describedby={describedBy}
      aria-label={label}
      onClick={(e) => {
        if (inactive) {
          e.preventDefault();
          return;
        }
        onClick?.();
      }}
    >
      <span className="btn__label hstack" style={{ gap: 8 }}>
        {icon}
        {children}
      </span>
      {loading && (
        <span className="btn__spinner" aria-hidden="true">
          <span className="spinner" />
        </span>
      )}
    </button>
  );
}

/* ---------- Text field ---------- */
interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'prefix'> {
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string | null;
  helper?: ReactNode;
  prefix?: string;
  reveal?: boolean;
  multiline?: boolean;
  hideLabel?: boolean;
}

export const TextField = forwardRef<HTMLInputElement | HTMLTextAreaElement, TextFieldProps>(function TextField(
  { label, value, onChange, error, helper, prefix, reveal, multiline, disabled, hideLabel, id: idProp, type, ...rest },
  ref,
) {
  const autoId = useId();
  const id = idProp ?? autoId;
  const [shown, setShown] = useState(false);
  const helperId = helper ? `${id}-help` : undefined;
  const errorId = error ? `${id}-err` : undefined;
  const describedBy = [errorId, helperId].filter(Boolean).join(' ') || undefined;
  return (
    <div className={`field${error ? ' field--error' : ''}${disabled ? ' field--disabled' : ''}`}>
      <label htmlFor={id} className={hideLabel ? 'sr-only' : 'field__label'}>
        {label}
      </label>
      <div className="field__box">
        {prefix && <span className="field__prefix" aria-hidden="true">{prefix}</span>}
        {multiline ? (
          <textarea
            id={id}
            ref={ref as React.Ref<HTMLTextAreaElement>}
            className="field__input"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            aria-invalid={error ? true : undefined}
            aria-describedby={describedBy}
            disabled={disabled}
            rows={2}
            placeholder={rest.placeholder}
            maxLength={rest.maxLength}
          />
        ) : (
          <input
            id={id}
            ref={ref as React.Ref<HTMLInputElement>}
            className="field__input"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            aria-invalid={error ? true : undefined}
            aria-describedby={describedBy}
            disabled={disabled}
            type={reveal ? (shown ? 'text' : 'password') : type}
            {...rest}
          />
        )}
        {reveal && (
          <button type="button" className="field__reveal" onClick={() => setShown((s) => !s)} aria-label={shown ? 'Hide password' : 'Show password'} aria-pressed={shown}>
            <Icon name={shown ? 'eye.slash' : 'eye'} size={22} />
          </button>
        )}
      </div>
      {error && (
        <p id={errorId} className="field__error" role="alert">
          <Icon name="exclamationmark.circle.fill" size={16} />
          <span>{error}</span>
        </p>
      )}
      {helper && (
        <p id={helperId} className="helper" style={{ marginTop: 0 }}>
          {helper}
        </p>
      )}
    </div>
  );
});

/* ---------- Search field ---------- */
export function SearchField({ value, onChange, onSubmit, placeholder, label }: { value: string; onChange: (v: string) => void; onSubmit?: (v: string) => void; placeholder: string; label: string }) {
  return (
    <form
      role="search"
      className="search"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit?.(value);
        (document.activeElement as HTMLElement | null)?.blur();
      }}
    >
      <Icon name="magnifyingglass" size={20} />
      <input type="search" enterKeyHint="search" aria-label={label} placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} autoComplete="off" />
      {value && (
        <button type="button" className="search__clear" aria-label="Clear search" onClick={() => onChange('')}>
          <Icon name="xmark" size={16} />
        </button>
      )}
    </form>
  );
}

/* ---------- Filter chip ---------- */
/** removable: an applied filter (selected fill plus xmark; tap removes). xWhenSelected: S06 style. */
export function Chip({ label, selected, onToggle, removable, xWhenSelected, disabled }: { label: string; selected?: boolean; onToggle?: () => void; removable?: boolean; xWhenSelected?: boolean; disabled?: boolean }) {
  const on = removable || selected;
  return (
    <button
      type="button"
      className={`chip${on ? ' chip--selected' : ''}`}
      aria-pressed={removable ? undefined : !!selected}
      aria-disabled={disabled || undefined}
      aria-label={removable ? `${label}, filter, selected. Remove` : undefined}
      onClick={() => !disabled && onToggle?.()}
    >
      <span className="chip__face">
        {label}
        {(removable || (xWhenSelected && selected)) && <Icon name="xmark" size={14} />}
      </span>
    </button>
  );
}

/* ---------- Segmented control ---------- */
export function Segmented<T extends string>({ options, value, onChange, label }: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void; label: string }) {
  const onKey = (e: KeyboardEvent, i: number) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    const next = options[(i + (e.key === 'ArrowRight' ? 1 : options.length - 1)) % options.length];
    onChange(next.value);
    const el = (e.currentTarget.parentElement?.children[options.indexOf(next)] as HTMLElement | undefined);
    el?.focus();
  };
  return (
    <div className="seg" role="radiogroup" aria-label={label}>
      {options.map((o, i) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          className="seg__item"
          aria-checked={o.value === value}
          tabIndex={o.value === value ? 0 : -1}
          onClick={() => onChange(o.value)}
          onKeyDown={(e) => onKey(e, i)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ---------- Status badge ---------- */
export type Tone = 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'gold';
export function Badge({ tone = 'neutral', children }: { tone?: Tone; children: ReactNode }) {
  return <span className={`badge badge--${tone}`}>{children}</span>;
}

/* ---------- Step indicator ---------- */
export function StepIndicator({ total, current, label }: { total: number; current: number; label: string }) {
  return (
    <div className="steps">
      <p className="t-footnote c-secondary">
        Step {current} of {total} · {label}
      </p>
      <div className="steps__bar" role="progressbar" aria-valuemin={1} aria-valuemax={total} aria-valuenow={current} aria-label={`Step ${current} of ${total}`}>
        {Array.from({ length: total }, (_, i) => (
          <span key={i} className={`steps__seg${i < current ? ' steps__seg--on' : ''}`} />
        ))}
      </div>
    </div>
  );
}

/* ---------- List row ---------- */
export interface ListRowProps {
  title: ReactNode;
  subtitle?: ReactNode;
  value?: ReactNode;
  chevron?: boolean;
  onClick?: () => void;
  disabled?: boolean;
  destructive?: boolean;
  leading?: ReactNode;
  label?: string;
  single?: boolean;
  trailing?: ReactNode;
}

export function ListRow({ title, subtitle, value, chevron, onClick, disabled, destructive, leading, label, single, trailing }: ListRowProps) {
  const inner = (
    <>
      {leading}
      <span className="row__text">
        <span className="row__title">{title}</span>
        {subtitle && <span className="row__subtitle">{subtitle}</span>}
      </span>
      {value !== undefined && <span className="row__value">{value}</span>}
      {trailing}
      {chevron && <Icon name="chevron.right" size={16} className="row__chev" />}
    </>
  );
  const cls = `row${destructive ? ' row--destructive' : ''}${single || !subtitle ? ' row--single' : ''}`;
  if (onClick)
    return (
      <button type="button" className={cls} onClick={() => !disabled && onClick()} aria-disabled={disabled || undefined} aria-label={label}>
        {inner}
      </button>
    );
  return (
    <div className={cls} aria-label={label} role={label ? 'group' : undefined}>
      {inner}
    </div>
  );
}

export function Group({ children, label, labelId }: { children: ReactNode; label?: string; labelId?: string }) {
  return (
    <section className="stack-6" aria-labelledby={label ? labelId : undefined}>
      {label && (
        <h2 className="section-label" id={labelId}>
          {label}
        </h2>
      )}
      <div className="group">{children}</div>
    </section>
  );
}

/* ---------- Inline alert ---------- */
export function InlineAlert({ tone, title, children }: { tone: 'info' | 'warning' | 'danger' | 'success'; title: ReactNode; children?: ReactNode }) {
  const icon = tone === 'info' ? 'info.circle.fill' : tone === 'success' ? 'checkmark.circle.fill' : 'exclamationmark.triangle.fill';
  return (
    <div className={`inline-alert inline-alert--${tone}`} role={tone === 'danger' ? 'alert' : 'status'}>
      <Icon name={icon} size={20} />
      <div className="stack-6" style={{ gap: 2 }}>
        <p className="inline-alert__title">{title}</p>
        {children && <p>{children}</p>}
      </div>
    </div>
  );
}

/* ---------- Avatar ---------- */
export function Avatar({ initials, large }: { initials: string; large?: boolean }) {
  return (
    <span className={`avatar${large ? ' avatar--lg' : ''}`} aria-hidden="true">
      {initials}
    </span>
  );
}

/* ---------- Time slot and day pill ---------- */
export function TimeSlot({ time, status, selected, onSelect }: { time: string; status: 'open' | 'taken'; selected?: boolean; onSelect?: () => void }) {
  if (status === 'taken')
    return (
      <div className="slot slot--taken" role="radio" aria-checked={false} aria-disabled="true" aria-label={`${time}, Booked`}>
        <span className="slot__time">{time}</span>
        <span className="slot__status">Booked</span>
      </div>
    );
  return (
    <button type="button" role="radio" className="slot" aria-checked={!!selected} onClick={onSelect} aria-label={`${time}, ${selected ? 'Selected' : 'Open'}`}>
      <span className="slot__time">{time}</span>
      <span className="slot__status">{selected ? 'Selected' : 'Open'}</span>
    </button>
  );
}

export function DayPill({ weekday, date, selected, today, hasLessons, onClick, label }: { weekday: string; date: number; selected?: boolean; today?: boolean; hasLessons?: boolean; onClick: () => void; label: string }) {
  return (
    <button type="button" className={`day${today && !selected ? ' day--today' : ''}`} aria-pressed={!!selected} onClick={onClick} aria-label={`${label}${today ? ', today' : ''}${hasLessons ? ', has lessons' : ''}`}>
      <span className="day__wd">{weekday}</span>
      <span className="day__date">{date}</span>
      {hasLessons && <span className="day__dot" />}
    </button>
  );
}

/* ---------- Milestone row ---------- */
export type MilestoneState = 'confirmed' | 'practicing' | 'upcoming';
export function MilestoneRow({ title, state, status, onToggle, pressed }: { title: ReactNode; state: MilestoneState; status?: ReactNode; onToggle?: () => void; pressed?: boolean }) {
  const icon = state === 'confirmed' ? 'checkmark.circle.fill' : state === 'practicing' ? 'circle.practicing' : 'circle';
  const spoken = state === 'confirmed' ? 'Confirmed' : state === 'practicing' ? 'Practicing' : 'Upcoming';
  const body = (
    <>
      <Icon name={icon} size={22} className="milestone__icon" />
      <span className="stack-6" style={{ gap: 2 }}>
        <span className="t-body milestone__title">{title}</span>
        {status && <span className={`t-footnote ${state === 'confirmed' ? 'c-success' : 'c-secondary'}`}>{status}</span>}
        <span className="sr-only">, {spoken}</span>
      </span>
    </>
  );
  if (onToggle)
    return (
      <button type="button" className={`milestone milestone--${state}`} onClick={onToggle} aria-pressed={pressed}>
        {body}
      </button>
    );
  return <div className={`milestone milestone--${state}`}>{body}</div>;
}

/* ---------- Transaction row ---------- */
const TXN_TONE: Record<string, Tone> = { pending: 'warning', available: 'success', paid_out: 'neutral', refunded: 'danger' };
const TXN_LABEL: Record<string, string> = { pending: 'Pending', available: 'Available', paid_out: 'Paid out', refunded: 'Refunded' };
export function TransactionRow({ title, subtitle, amount, state, onClick }: { title: ReactNode; subtitle: ReactNode; amount: string; state: string; onClick?: () => void }) {
  const inner = (
    <>
      <span className="row__text">
        <span className="t-subhead-em" style={{ fontSize: '1rem' }}>
          {title}
        </span>
        <span className="row__subtitle">{subtitle}</span>
      </span>
      <span className="txn__amount">
        <span className={state === 'refunded' ? 'strike' : undefined} style={{ fontSize: '1rem' }}>
          {amount}
        </span>
        <Badge tone={TXN_TONE[state]}>{TXN_LABEL[state]}</Badge>
      </span>
    </>
  );
  return onClick ? (
    <button type="button" className="txn" onClick={onClick}>
      {inner}
    </button>
  ) : (
    <div className="txn">{inner}</div>
  );
}

/* ---------- Empty state, skeleton ---------- */
export function EmptyState({ icon, title, message, action, secondary, inCard }: { icon: string; title: string; message: ReactNode; action?: ReactNode; secondary?: ReactNode; inCard?: boolean }) {
  return (
    <div className="empty" style={inCard ? { background: 'var(--bg-elevated)', borderRadius: 16 } : undefined}>
      <span className="icon-circle icon-circle--lg" aria-hidden="true">
        <Icon name={icon} size={30} />
      </span>
      <h2 className="t-title3">{title}</h2>
      <p className="empty__msg">{message}</p>
      {action && <div style={{ width: '100%', maxWidth: 312 }}>{action}</div>}
      {secondary && <div style={{ width: '100%', maxWidth: 312, marginTop: -2 }}>{secondary}</div>}
    </div>
  );
}

export function SkeletonCard() {
  return (
    <div className="skeleton" aria-hidden="true">
      <i className="circle" />
      <i style={{ width: '70%', marginTop: 8 }} />
      <i style={{ width: '45%' }} />
      <i className="wide" style={{ marginTop: 12 }} />
      <i className="wide" style={{ width: '70%' }} />
    </div>
  );
}

/* ---------- Stars ---------- */
export function Stars({ n, size = 16 }: { n: number; size?: number }) {
  return (
    <span className="star-row" aria-hidden="true">
      {Array.from({ length: 5 }, (_, i) => (
        <span key={i} style={{ opacity: i < Math.round(n) ? 1 : 0.25 }}>
          <Icon name="star.fill" size={size} />
        </span>
      ))}
    </span>
  );
}

export function SectionHeader({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="spread">
      <h2 className="section-title">{title}</h2>
      {action}
    </div>
  );
}

export function Radio({ on }: { on: boolean }) {
  return on ? (
    <span className="radio radio--on" aria-hidden="true">
      <Icon name="checkmark" size={14} />
    </span>
  ) : (
    <span className="radio" aria-hidden="true" />
  );
}
