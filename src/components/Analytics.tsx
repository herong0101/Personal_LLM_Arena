'use client';

import { useState, useMemo } from 'react';
import { useArena } from '@/context/ArenaContext';
import { ModelStats } from '@/types';
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from 'recharts';

export default function Analytics() {
  const { state, resetArena } = useArena();
  const { session, selectedModels } = state;
  const [feedback, setFeedback] = useState<Record<string, string>>({});
  const [overallComment, setOverallComment] = useState('');
  const [chartType, setChartType] = useState<'radar' | 'bar'>('bar');

  // Calculate statistics
  const stats: ModelStats[] = useMemo(() => {
    if (!session || session.rounds.length === 0) return [];

    const modelStatsMap = new Map<string, ModelStats>();

    // Initialize stats for each model
    selectedModels.forEach((model) => {
      modelStatsMap.set(model.id, {
        modelId: model.id,
        modelName: model.name,
        totalRounds: 0,
        averageRank: 0,
        firstPlaceCount: 0,
        secondPlaceCount: 0,
        thirdPlaceCount: 0,
      });
    });

    // Accumulate stats from rounds
    session.rounds.forEach((round) => {
      round.rankings.forEach((ranking) => {
        const stat = modelStatsMap.get(ranking.modelId);
        if (stat) {
          stat.totalRounds++;
          stat.averageRank += ranking.rank;
          if (ranking.rank === 1) stat.firstPlaceCount++;
          if (ranking.rank === 2) stat.secondPlaceCount++;
          if (ranking.rank === 3) stat.thirdPlaceCount++;
        }
      });
    });

    // Calculate averages
    modelStatsMap.forEach((stat) => {
      if (stat.totalRounds > 0) {
        stat.averageRank = stat.averageRank / stat.totalRounds;
      }
    });

    return Array.from(modelStatsMap.values());
  }, [session, selectedModels]);

  // Prepare chart data
  const chartData = useMemo(() => {
    return stats.map((stat) => ({
      name: stat.modelName,
      平均名次: Number((4 - stat.averageRank).toFixed(2)), // Invert for better visualization (higher is better)
      第一名次數: stat.firstPlaceCount,
      第二名次數: stat.secondPlaceCount,
      第三名次數: stat.thirdPlaceCount,
      總局數: stat.totalRounds,
    }));
  }, [stats]);

  // Radar chart data
  const radarData = useMemo(() => {
    if (stats.length === 0) return [];

    const maxRounds = Math.max(...stats.map((s) => s.totalRounds), 1);

    return [
      {
        metric: '勝率',
        ...stats.reduce(
          (acc, stat) => ({
            ...acc,
            [stat.modelName]: stat.totalRounds > 0 ? (stat.firstPlaceCount / stat.totalRounds) * 100 : 0,
          }),
          {}
        ),
      },
      {
        metric: '表現穩定度',
        ...stats.reduce(
          (acc, stat) => ({
            ...acc,
            [stat.modelName]:
              stat.totalRounds > 0
                ? ((stat.firstPlaceCount + stat.secondPlaceCount) / stat.totalRounds) * 100
                : 0,
          }),
          {}
        ),
      },
      {
        metric: '參與度',
        ...stats.reduce(
          (acc, stat) => ({
            ...acc,
            [stat.modelName]: (stat.totalRounds / maxRounds) * 100,
          }),
          {}
        ),
      },
      {
        metric: '平均排名分',
        ...stats.reduce(
          (acc, stat) => ({
            ...acc,
            [stat.modelName]: stat.totalRounds > 0 ? ((4 - stat.averageRank) / 3) * 100 : 0,
          }),
          {}
        ),
      },
    ];
  }, [stats]);

  const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6'];

  const handleNewSession = () => {
    resetArena();
  };

  const totalRounds = session?.rounds.length || 0;
  const winner = stats.reduce(
    (best, current) => (current.averageRank < best.averageRank ? current : best),
    stats[0]
  );

  return (
    <div className="min-h-screen bg-[var(--background)] p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12 animate-fade-in">
          <h1 className="font-['Cinzel',serif] text-4xl md:text-5xl font-bold stone-text mb-4">
            挑戰統計
          </h1>
          <p className="text-[var(--slate-600)] text-lg">
            完成了 {totalRounds} 局盲測對決
          </p>
        </div>

        {/* Winner announcement */}
        {winner && totalRounds > 0 && (
          <div className="marble-card rounded-2xl p-8 mb-8 text-center animate-fade-in">
            <div className="text-6xl mb-4">🏆</div>
            <h2 className="font-['Cinzel',serif] text-2xl font-semibold text-[var(--slate-800)] mb-2">
              您的最佳選擇
            </h2>
            <p className="text-4xl font-bold gold-text mb-2">{winner.modelName}</p>
            <p className="text-[var(--slate-600)]">
              平均排名：{winner.averageRank.toFixed(2)} | 第一名次數：{winner.firstPlaceCount}
            </p>
          </div>
        )}

        {/* Stats cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {stats.map((stat, index) => (
            <div
              key={stat.modelId}
              className="marble-card rounded-xl p-6 animate-fade-in"
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-lg text-[var(--slate-800)]">{stat.modelName}</h3>
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: COLORS[index % COLORS.length] }}
                />
              </div>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-[var(--slate-500)]">平均排名</span>
                  <span className="font-semibold text-[var(--slate-800)]">
                    {stat.averageRank.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--slate-500)]">🥇 第一名</span>
                  <span className="font-semibold text-[var(--gold-500)]">{stat.firstPlaceCount} 次</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--slate-500)]">🥈 第二名</span>
                  <span className="font-semibold text-[var(--slate-500)]">{stat.secondPlaceCount} 次</span>
                </div>
                {selectedModels.length > 2 && (
                  <div className="flex justify-between">
                    <span className="text-[var(--slate-500)]">🥉 第三名</span>
                    <span className="font-semibold text-[var(--gold-600)]">{stat.thirdPlaceCount} 次</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Feedback section */}
        <div className="marble-card rounded-xl p-6 mb-8 animate-fade-in">
          <h3 className="font-['Cinzel',serif] text-xl font-semibold text-[var(--slate-800)] mb-6">
            您的評語
          </h3>

          {/* Individual model feedback */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            {selectedModels.map((model) => (
              <div key={model.id}>
                <label className="block text-sm font-medium text-[var(--slate-700)] mb-2">
                  {model.name}
                </label>
                <textarea
                  value={feedback[model.id] || ''}
                  onChange={(e) => setFeedback({ ...feedback, [model.id]: e.target.value })}
                  placeholder={`對 ${model.name} 的評價...`}
                  rows={3}
                  className="w-full px-4 py-2 rounded-lg border border-[var(--marble-300)] 
                           bg-white focus:outline-none focus:ring-2 focus:ring-[var(--emerald-400)] 
                           resize-none"
                />
              </div>
            ))}
          </div>

          {/* Overall feedback */}
          <div>
            <label className="block text-sm font-medium text-[var(--slate-700)] mb-2">
              整體感想
            </label>
            <textarea
              value={overallComment}
              onChange={(e) => setOverallComment(e.target.value)}
              placeholder="分享您對這次盲測體驗的整體感想..."
              rows={4}
              className="w-full px-4 py-2 rounded-lg border border-[var(--marble-300)] 
                       bg-white focus:outline-none focus:ring-2 focus:ring-[var(--emerald-400)] 
                       resize-none"
            />
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex justify-center gap-4">
          <button
            onClick={handleNewSession}
            className="metal-button text-white font-['Cinzel',serif] px-8 py-3 rounded-lg"
          >
            開始新挑戰
          </button>
        </div>
      </div>
    </div>
  );
}
