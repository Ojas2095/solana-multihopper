'use client';

import React, { useState } from 'react';
import { RoutePlan } from '../../core/graph.js';
import { SimulationProfile, TransactionSimulator } from '../../core/simulator.js';
import { SwapCard } from '../components/SwapCard.js';
import { RouteVisualizer } from '../components/RouteVisualizer.js';
import { MetricsDisplay } from '../components/MetricsDisplay.js';

export default function MultiHopperPage() {
  const [route, setRoute] = useState<RoutePlan | null>(null);
  const [profile, setProfile] = useState<SimulationProfile | null>(null);

  const handleSimulate = () => {
    if (route) {
      const sim = new TransactionSimulator();
      const p = sim.profileRoute(route);
      setProfile(p);
    }
  };

  return (
    <main className="max-w-6xl mx-auto px-4 py-8 space-y-8">
      {/* Header */}
      <header className="flex flex-col md:flex-row items-start md:items-center justify-between pb-6 border-b border-slate-800 gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-cyan-500 flex items-center justify-center font-bold text-slate-950 text-xl shadow-lg shadow-emerald-500/20">
              ⚡
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-white">
                MultiHopper <span className="text-emerald-400">Router</span>
              </h1>
              <p className="text-xs text-slate-400">
                Solana Multi-Hop DEX Routing Engine & Jupiter v6 Comparative Analyzer
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs">
            <span className="h-2 w-2 rounded-full bg-emerald-400"></span>
            <span className="text-slate-300">Solana Mainnet-Beta</span>
          </div>
          <button className="bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-semibold px-4 py-2 rounded-lg transition">
            Connect Wallet
          </button>
        </div>
      </header>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <div className="lg:col-span-5 flex justify-center">
          <SwapCard
            onRouteCalculated={(newRoute) => {
              setRoute(newRoute);
              if (newRoute) {
                const sim = new TransactionSimulator();
                setProfile(sim.profileRoute(newRoute));
              } else {
                setProfile(null);
              }
            }}
            onSimulateRequested={handleSimulate}
          />
        </div>

        <div className="lg:col-span-7 space-y-6">
          <RouteVisualizer route={route} />
          <MetricsDisplay route={route} profile={profile} />
        </div>
      </div>
    </main>
  );
}
