'use client';

import { useArena } from '@/context/ArenaContext';

export default function LandingPage() {
  const { dispatch } = useArena();

  const handleStart = () => {
    dispatch({ type: 'SET_PHASE', payload: 'selection' });
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8 relative overflow-hidden">
      {/* Decorative background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* Columns */}
        <div className="absolute left-[10%] top-0 bottom-0 w-16 bg-gradient-to-b from-[var(--marble-200)] via-[var(--marble-100)] to-[var(--marble-200)] opacity-30 rounded-b-full" />
        <div className="absolute right-[10%] top-0 bottom-0 w-16 bg-gradient-to-b from-[var(--marble-200)] via-[var(--marble-100)] to-[var(--marble-200)] opacity-30 rounded-b-full" />
        
        {/* Decorative circles */}
        <div className="absolute top-20 left-20 w-32 h-32 rounded-full bg-[var(--emerald-200)] opacity-20 blur-3xl" />
        <div className="absolute bottom-20 right-20 w-48 h-48 rounded-full bg-[var(--emerald-300)] opacity-20 blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full border border-[var(--marble-200)] opacity-50" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full border border-[var(--marble-200)] opacity-30" />
      </div>

      {/* Main content */}
      <div className="relative z-10 text-center max-w-3xl mx-auto animate-fade-in">
        {/* Laurel wreath decoration */}
        <div className="flex justify-center mb-6">
          <svg className="w-24 h-24 text-[var(--emerald-500)]" viewBox="0 0 100 100" fill="currentColor">
            <path d="M50 10 C30 10 15 30 15 50 C15 70 30 90 50 90 C70 90 85 70 85 50 C85 30 70 10 50 10 M50 15 C67 15 80 32 80 50 C80 68 67 85 50 85 C33 85 20 68 20 50 C20 32 33 15 50 15" opacity="0.2"/>
            <path d="M25 50 Q20 35 30 25 Q25 40 30 50 Q25 60 30 75 Q20 65 25 50" />
            <path d="M75 50 Q80 35 70 25 Q75 40 70 50 Q75 60 70 75 Q80 65 75 50" />
          </svg>
        </div>

        {/* Main title with stone effect */}
        <h1 className="font-['Cinzel',serif] text-6xl md:text-7xl lg:text-8xl font-bold mb-4 stone-text tracking-wider">
          模型比一比
        </h1>

        {/* Subtitle */}
        <p className="font-['Cinzel',serif] text-xl md:text-2xl text-[var(--slate-600)] mb-2 tracking-wide">
          Arena of Intelligence
        </p>

        {/* Decorative line */}
        <div className="flex items-center justify-center gap-4 my-8">
          <div className="h-px w-16 bg-gradient-to-r from-transparent to-[var(--emerald-400)]" />
          <div className="w-3 h-3 rotate-45 border-2 border-[var(--emerald-400)]" />
          <div className="h-px w-16 bg-gradient-to-l from-transparent to-[var(--emerald-400)]" />
        </div>

        {/* Description */}
        <p className="text-lg text-[var(--slate-600)] mb-12 max-w-xl mx-auto leading-relaxed">
          在這座智慧的競技場中，讓 AI 模型們一較高下。
          <br />
          盲測評比，找出您心目中的最強模型。
        </p>

        {/* CTA Button */}
        <button
          onClick={handleStart}
          className="metal-button text-white font-['Cinzel',serif] text-xl px-12 py-4 rounded-lg 
                     tracking-wider uppercase transition-all duration-300"
        >
          開始挑戰
        </button>

        {/* Features */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-16">
          <FeatureCard
            icon={
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            }
            title="盲測評比"
            description="不知道模型名稱，純粹以回答品質評判"
          />
          <FeatureCard
            icon={
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            }
            title="多模型對決"
            description="最多同時比較三個不同的 AI 模型"
          />
          <FeatureCard
            icon={
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
              </svg>
            }
            title="統計分析"
            description="完成挑戰後獲得個人偏好統計報告"
          />
        </div>
      </div>
    </div>
  );
}

interface FeatureCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
}

function FeatureCard({ icon, title, description }: FeatureCardProps) {
  return (
    <div className="marble-card rounded-xl p-6 text-center hover:shadow-lg transition-shadow flex flex-col items-center justify-center">
      <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-[var(--emerald-50)] text-[var(--emerald-600)] mb-4">
        {icon}
      </div>
      <h3 className="font-['Cinzel',serif] text-lg font-semibold text-[var(--slate-800)] mb-2">
        {title}
      </h3>
      <p className="text-xs text-[var(--slate-600)] leading-relaxed px-1">{description}</p>
    </div>
  );
}
