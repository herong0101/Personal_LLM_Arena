'use client';

import { useArena } from '@/context/ArenaContext';
import LandingPage from '@/components/LandingPage';
import ModelSelection from '@/components/ModelSelection';
import BlindArena from '@/components/BlindArena';
import Analytics from '@/components/Analytics';

export default function Home() {
  const { state } = useArena();
  const { currentPhase } = state;

  return (
    <>
      {currentPhase === 'landing' && <LandingPage />}
      {currentPhase === 'selection' && <ModelSelection />}
      {currentPhase === 'arena' && <BlindArena />}
      {currentPhase === 'analytics' && <Analytics />}
    </>
  );
}
