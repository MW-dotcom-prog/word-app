import type { ReactNode } from 'react';

export type IconName =
  | 'home'
  | 'book'
  | 'search'
  | 'user'
  | 'speaker'
  | 'back'
  | 'check'
  | 'close'
  | 'flame'
  | 'cards'
  | 'refresh'
  | 'chart'
  | 'chevron-right'
  | 'arrow-right'
  | 'globe'
  | 'trash'
  | 'sparkle'
  | 'bookmark'
  | 'shuffle';

const PATHS: Record<IconName, ReactNode> = {
  home: (
    <>
      <path d="M3 10.7 12 3l9 7.7" />
      <path d="M5 9.5V21h14V9.5" />
      <path d="M9.5 21v-6h5v6" />
    </>
  ),
  book: (
    <>
      <path d="M4 4.5h5.3A2.7 2.7 0 0 1 12 7.2V21a2.3 2.3 0 0 0-2.3-2.3H4z" />
      <path d="M20 4.5h-5.3A2.7 2.7 0 0 0 12 7.2V21a2.3 2.3 0 0 1 2.3-2.3H20z" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m16.5 16.5 4.5 4.5" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4.5 21c.8-3.6 3.7-5.5 7.5-5.5s6.7 1.9 7.5 5.5" />
    </>
  ),
  speaker: (
    <>
      <path d="M4 9.5v5h3l4.5 3.5v-12L7 9.5H4z" />
      <path d="M15.5 8.5a5 5 0 0 1 0 7" />
      <path d="M18.2 6a8.5 8.5 0 0 1 0 12" />
    </>
  ),
  back: <path d="M15 18l-6-6 6-6" />,
  check: <path d="m4.5 12.5 5 5 10-11" />,
  close: (
    <>
      <path d="M6 6l12 12" />
      <path d="M18 6 6 18" />
    </>
  ),
  flame: (
    <path d="M12.2 3c2.6 3.3 4.8 5.7 4.8 9a5 5 0 0 1-10 0c0-1.6.7-2.9 1.8-4.3.9-1.2 2.1-2.7 3.4-4.7z" />
  ),
  cards: (
    <>
      <path d="m12 3 9 5-9 5-9-5 9-5z" />
      <path d="m3 12 9 5 9-5" />
      <path d="m3 16 9 5 9-5" />
    </>
  ),
  refresh: (
    <>
      <path d="M20 12a8 8 0 1 1-2.3-5.6" />
      <path d="M20 4v4.2h-4.2" />
    </>
  ),
  chart: (
    <>
      <path d="M4 20V10" />
      <path d="M10 20V4" />
      <path d="M16 20v-7" />
      <path d="M22 20H2" />
    </>
  ),
  'chevron-right': <path d="m9 6 6 6-6 6" />,
  'arrow-right': (
    <>
      <path d="M5 12h14" />
      <path d="m13 6 6 6-6 6" />
    </>
  ),
  globe: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18" />
      <path d="M12 3c2.5 2.4 4 5.6 4 9s-1.5 6.6-4 9c-2.5-2.4-4-5.6-4-9s1.5-6.6 4-9z" />
    </>
  ),
  trash: (
    <>
      <path d="M4 7h16" />
      <path d="M9 7V4h6v3" />
      <path d="m6 7 1 14h10l1-14" />
    </>
  ),
  sparkle: (
    <>
      <path d="M12 3v4" />
      <path d="M12 17v4" />
      <path d="M3 12h4" />
      <path d="M17 12h4" />
      <path d="m5.6 5.6 2.8 2.8" />
      <path d="m15.6 15.6 2.8 2.8" />
      <path d="m18.4 5.6-2.8 2.8" />
      <path d="m8.4 15.6-2.8 2.8" />
    </>
  ),
  bookmark: <path d="M6.5 4h11v16l-5.5-3.8L6.5 20V4z" />,
  shuffle: (
    <>
      <path d="M3 7h3.5c4.5 0 6.5 10 11 10H21" />
      <path d="M18 14l3 3-3 3" />
      <path d="M3 17h3.5c1.6 0 2.9-1.3 4.1-3" />
      <path d="M13.4 9.8C14.4 8.1 15.4 7 17.5 7H21" />
      <path d="M18 4l3 3-3 3" />
    </>
  ),
};

export function Icon({
  name,
  size = 24,
  className,
  filled = false,
}: {
  name: IconName;
  size?: number;
  className?: string;
  filled?: boolean;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      {PATHS[name]}
    </svg>
  );
}
