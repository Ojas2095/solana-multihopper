'use client';

import React from 'react';
import { RouteHop, RoutePlan } from '../../core/graph.js';
import { getTokenByMint, formatTokenAmount } from '../../core/tokens.js';

interface RouteVisualizerProps {
  route: RoutePlan | null;
}

export const RouteVisualizer: React.FC<RouteVisualizerProps> = ({ route }) => {
  if (!route) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center text-slate-400">
        <p className="text-sm">Select tokens and trade amount to compute multi-hop routing paths.</p>
      </div>
    );
  }

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl">
      <div className="flex items-center justify-between pb-4 border-b border-slate-800">
        <div>
          <h3 className="text-base font-semibold text-white">Execution Route Topology</h3>
          <p className="text-xs text-slate-400">
            {route.hops.length} {route.hops.length === 1 ? 'hop direct' : 'hops multi-path'} via Solana AMM pools
          </p>
        </div>
        <span className="px-3 py-1 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs rounded-full font-medium">
          Impact: {route.cumulativePriceImpactPct.toFixed(3)}%
        </span>
      </div>

      {/* Hop flow diagram */}
      <div className="py-6 flex flex-col md:flex-row items-center justify-between gap-4">
        {route.hops.map((hop: RouteHop, idx: number) => {
          const fromToken = getTokenByMint(hop.inputMint);
          const toToken = getTokenByMint(hop.outputMint);
          const fromSymbol = fromToken?.symbol || hop.inputMint.slice(0, 4);
          const toSymbol = toToken?.symbol || hop.outputMint.slice(0, 4);
          const fromDec = fromToken?.decimals || 6;
          const toDec = toToken?.decimals || 6;

          return (
            <React.Fragment key={hop.poolId + idx}>
              <div className="flex-1 bg-slate-950 border border-slate-800 rounded-lg p-4 relative w-full">
                <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                  <span className="font-mono text-purple-400 font-semibold uppercase">{hop.dex}</span>
                  <span className="bg-slate-800 px-2 py-0.5 rounded text-[10px] text-slate-300">
                    Fee: {(hop.feeBps / 100).toFixed(2)}%
                  </span>
                </div>

                <div className="flex items-center justify-between text-sm font-medium">
                  <span className="text-white">{fromSymbol}</span>
                  <span className="text-slate-500 text-xs">➔</span>
                  <span className="text-emerald-400">{toSymbol}</span>
                </div>

                <div className="mt-2 pt-2 border-t border-slate-900 flex justify-between text-[11px] text-slate-400">
                  <span>In: {formatTokenAmount(hop.amountIn, fromDec)}</span>
                  <span>Out: {formatTokenAmount(hop.amountOut, toDec)}</span>
                </div>
              </div>

              {idx < route.hops.length - 1 && (
                <div className="hidden md:flex flex-col items-center justify-center text-slate-600">
                  <span className="text-lg">→</span>
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t border-slate-800 text-center">
        <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/80">
          <div className="text-[11px] text-slate-400">Total Hops</div>
          <div className="text-base font-semibold text-white">{route.hops.length}</div>
        </div>
        <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/80">
          <div className="text-[11px] text-slate-400">Price Impact</div>
          <div className="text-base font-semibold text-emerald-400">{route.cumulativePriceImpactPct.toFixed(3)}%</div>
        </div>
        <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/80">
          <div className="text-[11px] text-slate-400">Routing Fee</div>
          <div className="text-base font-semibold text-white">{(route.totalFeeBps / 100).toFixed(2)}%</div>
        </div>
        <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/80">
          <div className="text-[11px] text-slate-400">Solver Speed</div>
          <div className="text-base font-semibold text-purple-400">{route.executionTimeMs} ms</div>
        </div>
      </div>
    </div>
  );
};
