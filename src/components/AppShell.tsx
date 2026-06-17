'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV_ITEMS = [
  {
    href: '/',
    label: '首頁',
    exact: true,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className="h-5 w-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="m3 12 2-2m0 0 7-7 7 7M5 10v10a1 1 0 0 0 1 1h3m10-11 2 2m-2-2v10a1 1 0 0 1-1 1h-3m-6 0a1 1 0 0 0 1-1v-4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v4a1 1 0 0 0 1 1m-6 0h6" />
      </svg>
    ),
  },
  {
    href: '/arena',
    label: '競技場',
    exact: false,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className="h-5 w-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
      </svg>
    ),
  },
  {
    href: '/studio',
    label: '工作室',
    exact: false,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className="h-5 w-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 0 1 .865-.501 48.172 48.172 0 0 0 3.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z" />
      </svg>
    ),
  },
  {
    href: '/graph',
    label: 'Graph',
    exact: false,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className="h-5 w-5">
        <circle cx="6" cy="7" r="3" />
        <circle cx="18" cy="7" r="3" />
        <circle cx="12" cy="17" r="3" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.7 8.5 10.8 14M15.3 8.5 13.2 14" />
      </svg>
    ),
  },
  {
    href: '/loop',
    label: 'Loop',
    exact: false,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className="h-5 w-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M17.65 6.35A8 8 0 1 0 20 12" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M17 3v4h4" />
        <path strokeLinecap="round" strokeLinejoin="round" d="m9.5 12 1.7 1.7 3.8-4" />
      </svg>
    ),
  },
  {
    href: '/history',
    label: '歷史',
    exact: false,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className="h-5 w-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 12a9 9 0 1 0 3-6.7L3 8" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 4v4h4" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 2" />
      </svg>
    ),
  },
];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex h-screen overflow-hidden">
      <nav
        aria-label="主要導覽"
        className="hidden w-[76px] shrink-0 flex-col border-r border-[var(--border-soft)] bg-white px-2 py-3 md:flex"
      >
        <Link
          href="/"
          aria-label="返回平台首頁"
          className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--slate-900)] text-xs font-bold tracking-[0.08em] text-white"
        >
          AI
        </Link>
        <div className="mt-5 flex flex-1 flex-col gap-1.5">
          {NAV_ITEMS.map(({ href, label, exact, icon }) => {
            const active = exact ? pathname === href : pathname.startsWith(href);

            return (
              <Link
                key={href}
                href={href}
                title={label}
                aria-current={active ? 'page' : undefined}
                className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-2xl px-1 text-[10px] font-semibold transition-colors ${
                  active
                    ? 'bg-[rgba(24,172,126,0.12)] text-[var(--emerald-700)]'
                    : 'text-[var(--slate-500)] hover:bg-[var(--background)] hover:text-[var(--slate-900)]'
                }`}
              >
                {icon}
                <span>{label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden pb-16 md:pb-0">{children}</div>

      <nav
        aria-label="主要導覽"
        className="fixed inset-x-0 bottom-0 z-50 grid h-16 grid-cols-6 border-t border-[var(--border-soft)] bg-white/95 px-1 backdrop-blur-xl md:hidden"
      >
        {NAV_ITEMS.map(({ href, label, exact, icon }) => {
          const isActive = exact ? pathname === href : pathname.startsWith(href) && href !== '/';
          const isHomeActive = href === '/' && pathname === '/';
          const active = isActive || isHomeActive;

          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? 'page' : undefined}
              className={`flex flex-col items-center justify-center gap-1 text-[11px] font-medium ${
                active ? 'text-[var(--emerald-700)]' : 'text-[var(--slate-500)]'
              }`}
            >
              <span className={`rounded-2xl p-1.5 ${active ? 'bg-[rgba(24,172,126,0.12)]' : ''}`}>
                {icon}
              </span>
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
