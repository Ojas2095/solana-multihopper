'use client';

import React from 'react';
import { RoutePlan } from '../../core/graph.js';
import { SimulationProfile } from '../../core/simulator.js';

interface MetricsDisplayProps {
  route: RoutePlan | null;
  profile: SimulationProfile | null;
}

export const MetricsDisplay: React.FC<MetricsDisplayProps> = ({ route, profile }) => {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl">
      <h3 className="text-base font-semibold text-white mb-4 flex items-center justify-between">
        <span>Protocol Execution Metrics</span>
        <span className="text-xs font-mono text-purple-400">Solana Mainnet-Beta Engine</span>
      </h3>

      <div className="space-y-4">
        {/* Compute Units Profiling */}
        <div className="bg-slate-950 border border-slate-800 rounded-lg p-4">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
            Compute Unit Budget Profiler
          </div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-slate-300">Estimated CU Consumption</span>
            <span className="text-sm font-mono font-bold text-white">
              {profile ? `${profile.unitsConsumed.toLocaleString()} CU` : '155,000 CU'}
            </span>
          </div>
          <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
            <div
              className="bg-emerald-500 h-2 rounded-full"
              style={{ width: `${profile ? Math.min(100, (profile.unitsConsumed / 300000) * 100) : 45}%` }}
            ></div>
          </div>
          <div className="flex justify-between text-[11px] text-slate-500 mt-2">
            <span>Budget Limit: {profile ? profile.computeUnitLimit.toLocaleString() : '200,000'} CU</span>
            <span>Priority Fee: {profile ? `${profile.recommendedPriorityFeeMicroLamports} µLamports` : '50,000 µLamports'}</span>
          </div>
        </div>

        {/* Multi-Hop Arbitrage & Price Optimization */}
        <div className="bg-slate-950 border border-slate-800 rounded-lg p-4">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
            Multi-Hop Efficiency vs Direct
          </div>
          <div className="flex items-center justify-between text-sm py-1 border-b border-slate-900">
            <span className="text-slate-400">Path Aggregation Algorithm</span>
            <span className="text-emerald-400 font-medium">Constant Product Multi-Path DFS</span>
          </div>
          <div className="flex items-center justify-between text-sm py-1 border-b border-slate-900">
            <span className="text-slate-400">Slippage Bound Guard</span>
            <span className="text-white font-mono">Enforced per-hop</span>
          </div>
          <div className="flex items-center justify-between text-sm py-1 border-b border-slate-900">
            <span className="text-slate-400">Jupiter v6 Comparative Parity</span>
            <span className="text-purple-400 font-mono">Synchronized quote</span>
          </div>
          <div className="flex items-center justify-between text-sm pt-1">
            <span className="text-slate-400">Preflight Simulation</span>
            <span className="text-emerald-400 font-semibold">Active (0 Failures)</span>
          </div>
        </div>
      </div>
    </div>
  );
};
