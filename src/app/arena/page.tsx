'use client';

import Link from 'next/link';
import { useArena } from '@/context/ArenaContext';
import LandingPage from '@/components/LandingPage';
import ModelSelection from '@/components/ModelSelection';
import BlindArena from '@/components/BlindArena';
import Analytics from '@/components/Analytics';

export default function ArenaPage() {
  const { state } = useArena();
  const { currentPhase } = state;

  return (
    <>
      {currentPhase !== 'arena' && (
        <div className="fixed right-5 top-5 z-50 sm:right-8 sm:top-6">
          <Link
            href="/"
            className="soft-button inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold text-[var(--slate-700)]"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
              <path d="m15 18-6-6 6-6" />
            </svg>
            平台首頁
          </Link>
        </div>
      )}
      {currentPhase === 'landing' && <LandingPage />}
      {currentPhase === 'selection' && <ModelSelection />}
      {currentPhase === 'arena' && <BlindArena />}
      {currentPhase === 'analytics' && <Analytics />}
    </>
  );
}