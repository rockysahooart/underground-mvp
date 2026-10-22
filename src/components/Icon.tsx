// Inline SVG stand-ins for the SF Symbols named on the Figma icon layers (chapter 08).
import type { ReactNode } from 'react';

const stroke = (d: string, w = 2) => <path d={d} fill="none" stroke="currentColor" strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" />;
const fill = (d: string) => <path d={d} fill="currentColor" fillRule="evenodd" />;
const knock = 'var(--bg-elevated)';

function seal(): string {
  const pts: string[] = [];
  for (let i = 0; i < 24; i++) {
    const r = i % 2 ? 8.6 : 10.2;
    const a = (i / 24) * Math.PI * 2;
    pts.push(`${(12 + r * Math.cos(a)).toFixed(2)},${(12 + r * Math.sin(a)).toFixed(2)}`);
  }
  return `M${pts.join('L')}Z`;
}
const SEAL = seal();

const ICONS: Record<string, ReactNode> = {
  'chevron.left': stroke('M15 5l-7 7 7 7', 2.4),
  'chevron.right': stroke('M9 5l7 7-7 7', 2.2),
  'chevron.down': stroke('M5 9l7 7 7-7', 2.2),
  xmark: stroke('M6 6l12 12M18 6L6 18', 2.2),
  ellipsis: (
    <>
      <circle cx="5.5" cy="12" r="1.8" fill="currentColor" />
      <circle cx="12" cy="12" r="1.8" fill="currentColor" />
      <circle cx="18.5" cy="12" r="1.8" fill="currentColor" />
    </>
  ),
  bell: fill('M12 3a6 6 0 0 0-6 6v3.6L4.3 15.4A1 1 0 0 0 5.2 17h13.6a1 1 0 0 0 .9-1.6L18 12.6V9a6 6 0 0 0-6-6Zm-2.6 15.2a2.6 2.6 0 0 0 5.2 0Z'),
  magnifyingglass: (
    <>
      <circle cx="10.5" cy="10.5" r="6.5" fill="none" stroke="currentColor" strokeWidth="2.2" />
      {stroke('M15.5 15.5L20.5 20.5', 2.4)}
    </>
  ),
  house: fill('M12 3.2 3 10.5V20a1 1 0 0 0 1 1h5.2v-6h5.6v6H20a1 1 0 0 0 1-1v-9.5Z'),
  'person.crop.circle': fill(
    'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm0 4.2a3.4 3.4 0 1 1 0 6.8 3.4 3.4 0 0 1 0-6.8ZM12 20a8 8 0 0 1-6.1-2.8C7 15.6 9.3 14.6 12 14.6s5 1 6.1 2.6A8 8 0 0 1 12 20Z',
  ),
  'music.note.list': (
    <>
      {stroke('M3 6h10M3 10.5h10M3 15h6', 2.2)}
      <circle cx="15.2" cy="17.4" r="2.6" fill="currentColor" />
      <path d="M16.6 4.5h5v3.2h-3v9.7h-2Z" fill="currentColor" />
    </>
  ),
  calendar: (
    <>
      <rect x="3.5" y="5" width="17" height="15.5" rx="2.6" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M3.5 7.6a2.6 2.6 0 0 1 2.6-2.6h11.8a2.6 2.6 0 0 1 2.6 2.6V10h-17Z" fill="currentColor" />
      {stroke('M8 3v3M16 3v3', 2)}
    </>
  ),
  'dollarsign.circle': (
    <>
      <circle cx="12" cy="12" r="10" fill="currentColor" />
      <path
        d="M12 5.8v12.4M15 8.6c-.6-.9-1.7-1.4-3-1.4-1.8 0-3 .9-3 2.3 0 3.2 6.2 1.8 6.2 5 0 1.4-1.3 2.4-3.2 2.4-1.4 0-2.6-.6-3.2-1.6"
        fill="none"
        stroke={knock}
        strokeWidth="1.9"
        strokeLinecap="round"
      />
    </>
  ),
  'music.note': (
    <>
      <circle cx="8.5" cy="17.5" r="3.2" fill="currentColor" />
      <path d="M10 4h8v4h-5.6v9.6H10Z" fill="currentColor" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="8.6" fill="none" stroke="currentColor" strokeWidth="1.9" />
      {stroke('M12 7.5V12l3 1.8', 1.9)}
    </>
  ),
  video: fill('M4.5 6.5h9a2.5 2.5 0 0 1 2.5 2.5v6a2.5 2.5 0 0 1-2.5 2.5h-9A2.5 2.5 0 0 1 2 15V9a2.5 2.5 0 0 1 2.5-2.5Zm12.5 4 4.4-2.7a.4.4 0 0 1 .6.3v7.8a.4.4 0 0 1-.6.3L17 13.5Z'),
  checkmark: stroke('M5 12.5l4.5 4.5L19 7.5', 2.4),
  'checkmark.circle.fill': (
    <>
      <circle cx="12" cy="12" r="10" fill="currentColor" />
      <path d="M7.4 12.3l3 3 6.2-6.4" fill="none" stroke="var(--icon-knock, #fff)" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  'checkmark.seal.fill': (
    <>
      <path d={SEAL} fill="currentColor" />
      <path d="M8 12.3l2.8 2.8 5.4-5.6" fill="none" stroke="var(--icon-knock, #fff)" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  circle: <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2" />,
  'circle.practicing': (
    <>
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2.4" />
      <path d="M12 6.2a5.8 5.8 0 0 1 0 11.6Z" fill="currentColor" />
    </>
  ),
  plus: stroke('M12 5v14M5 12h14', 2.2),
  minus: stroke('M5 12h14', 2.2),
  'plus.circle.fill': (
    <>
      <circle cx="12" cy="12" r="10" fill="currentColor" />
      <path d="M12 7.5v9M7.5 12h9" stroke={knock} strokeWidth="2.2" strokeLinecap="round" />
    </>
  ),
  'info.circle.fill': (
    <>
      <circle cx="12" cy="12" r="10" fill="currentColor" />
      <path d="M12 10.6v6" stroke="var(--icon-knock, #fff)" strokeWidth="2.3" strokeLinecap="round" />
      <circle cx="12" cy="7.4" r="1.4" fill="var(--icon-knock, #fff)" />
    </>
  ),
  'exclamationmark.triangle.fill': (
    <>
      <path d="M10.3 3.6a2 2 0 0 1 3.4 0l8.4 14.6a2 2 0 0 1-1.7 3H3.6a2 2 0 0 1-1.7-3Z" fill="currentColor" />
      <path d="M12 8.8v5.4" stroke="var(--icon-knock, #fff)" strokeWidth="2.2" strokeLinecap="round" />
      <circle cx="12" cy="17.4" r="1.3" fill="var(--icon-knock, #fff)" />
    </>
  ),
  'exclamationmark.circle.fill': (
    <>
      <circle cx="12" cy="12" r="10" fill="currentColor" />
      <path d="M12 6.8v6.4" stroke="var(--icon-knock, #fff)" strokeWidth="2.3" strokeLinecap="round" />
      <circle cx="12" cy="16.8" r="1.4" fill="var(--icon-knock, #fff)" />
    </>
  ),
  'star.fill': fill('M12 2.8l2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17.2l-5.7 3.1 1.2-6.4-4.7-4.4 6.4-.8Z'),
  eye: (
    <>
      <path d="M12 5.5c-5 0-8.6 4.4-9.6 6.5 1 2.1 4.6 6.5 9.6 6.5s8.6-4.4 9.6-6.5c-1-2.1-4.6-6.5-9.6-6.5Z" fill="currentColor" />
      <circle cx="12" cy="12" r="3.6" fill={knock} />
      <circle cx="12" cy="12" r="1.9" fill="currentColor" />
    </>
  ),
  'eye.slash': (
    <>
      <path d="M12 5.5c-5 0-8.6 4.4-9.6 6.5 1 2.1 4.6 6.5 9.6 6.5s8.6-4.4 9.6-6.5c-1-2.1-4.6-6.5-9.6-6.5Z" fill="none" stroke="currentColor" strokeWidth="1.9" />
      {stroke('M4 3.5l16 17', 2)}
    </>
  ),
  'line.3.horizontal': stroke('M4 7h16M4 12h16M4 17h16', 2),
  'line.3.horizontal.decrease': stroke('M4 7h16M7 12h10M10 17h4', 2.2),
  'arrow.triangle.2.circlepath': stroke('M4.5 11a7.5 7.5 0 0 1 13-4.5L19.5 9M19.5 4v5h-5M19.5 13a7.5 7.5 0 0 1-13 4.5L4.5 15M4.5 20v-5h5', 2),
  'arrow.up.circle.fill': (
    <>
      <circle cx="12" cy="12" r="11" fill="currentColor" />
      <path d="M12 17.5V7M7.5 11.2 12 6.8l4.5 4.4" fill="none" stroke={knock} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  'bubble.left': fill('M4.5 4.5h15A1.5 1.5 0 0 1 21 6v9.5a1.5 1.5 0 0 1-1.5 1.5H10l-4.6 3.6a.5.5 0 0 1-.8-.4V17H4.5A1.5 1.5 0 0 1 3 15.5V6a1.5 1.5 0 0 1 1.5-1.5Z'),
  building: fill('M5 3h9a1 1 0 0 1 1 1v4h4a1 1 0 0 1 1 1v12H4V4a1 1 0 0 1 1-1Zm2 3v2h2V6Zm4 0v2h2V6ZM7 10v2h2v-2Zm4 0v2h2v-2Zm6 0v2h1v-2ZM7 14v2h2v-2Zm4 0v2h2v-2Zm6 0v2h1v-2Zm-8 4v3h2v-3Z'),
  'person.fill': fill('M12 3.5a4.2 4.2 0 1 1 0 8.4 4.2 4.2 0 0 1 0-8.4ZM4 19.6C4 16.4 7.6 14 12 14s8 2.4 8 5.6V21H4Z'),
  'apple.logo': fill(
    'M16.37 12.6c-.02-2.3 1.88-3.4 1.97-3.46-1.07-1.57-2.74-1.79-3.33-1.81-1.42-.14-2.77.84-3.49.84-.72 0-1.83-.82-3.01-.8-1.55.02-2.98.9-3.78 2.29-1.61 2.8-.41 6.94 1.16 9.21.77 1.11 1.68 2.36 2.88 2.31 1.16-.05 1.6-.75 3-.75s1.79.75 3.01.72c1.25-.02 2.04-1.13 2.8-2.25.88-1.29 1.24-2.54 1.26-2.61-.03-.01-2.42-.93-2.47-3.69ZM14.07 5.85c.64-.78 1.07-1.85.95-2.92-.92.04-2.03.61-2.69 1.38-.59.68-1.11 1.77-.97 2.82 1.02.08 2.07-.52 2.71-1.28Z',
  ),
  heart: stroke('M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.2a4.3 4.3 0 0 1 7.5 2.6C19.5 15.4 12 20 12 20Z', 2),
  'heart.fill': fill('M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.2a4.3 4.3 0 0 1 7.5 2.6C19.5 15.4 12 20 12 20Z'),
  'square.and.arrow.up': stroke('M12 3.5v11M8 7.2l4-3.7 4 3.7M7.5 10.5H6a1.5 1.5 0 0 0-1.5 1.5v7A1.5 1.5 0 0 0 6 20.5h12a1.5 1.5 0 0 0 1.5-1.5v-7a1.5 1.5 0 0 0-1.5-1.5h-1.5', 2),
  doc: stroke('M6.5 3.5h7l4 4V20a.5.5 0 0 1-.5.5h-10.5a.5.5 0 0 1-.5-.5V4a.5.5 0 0 1 .5-.5ZM13 3.5V8h4.5', 1.9),
};

export function Icon({ name, size = 22, className, label }: { name: string; size?: number; className?: string; label?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={className}
      aria-hidden={label ? undefined : true}
      role={label ? 'img' : undefined}
      aria-label={label}
      focusable="false"
      style={{ flex: 'none', display: 'block' }}
    >
      {ICONS[name] ?? ICONS.circle}
    </svg>
  );
}
