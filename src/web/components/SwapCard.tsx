'use client';

import React, { useState } from 'react';
import { TOKENS, TokenInfo, parseTokenAmount, formatTokenAmount } from '../../core/tokens.js';
import { RoutePlan } from '../../core/graph.js';
import { calculateMinimumAmountOut } from '../../core/math.js';

interface SwapCardProps {
  onRouteCalculated: (route: RoutePlan | null) => void;
  onSimulateRequested: () => void;
}

export const SwapCard: React.FC<SwapCardProps> = ({ onRouteCalculated, onSimulateRequested }) => {
  const [inputToken, setInputToken] = useState<TokenInfo>(TOKENS.SOL);
  const [outputToken, setOutputToken] = useState<TokenInfo>(TOKENS.BONK);
  const [amount, setAmount] = useState<string>('1.0');
  const [slippageBps, setSlippageBps] = useState<number>(50);
  const [isCalculating, setIsCalculating] = useState<boolean>(false);
  const [currentRoute, setCurrentRoute] = useState<RoutePlan | null>(null);

  const handleSwapTokens = () => {
    const prevIn = inputToken;
    setInputToken(outputToken);
    setOutputToken(prevIn);
  };

  const calculateRoute = async () => {
    if (!amount || parseFloat(amount) <= 0) return;
    setIsCalculating(true);
    try {
      const { MultiHopRouter } = await import('../../core/graph.js');
      const router = new MultiHopRouter();
      const amountRaw = parseTokenAmount(amount, inputToken.decimals);
      const plan = router.findBestRoute(inputToken.mint, outputToken.mint, amountRaw, 3);
      setCurrentRoute(plan);
      onRouteCalculated(plan);
    } catch (e) {
      console.error(e);
      setCurrentRoute(null);
      onRouteCalculated(null);
    } finally {
      setIsCalculating(false);
    }
  };

  React.useEffect(() => {
    calculateRoute();
  }, [inputToken, outputToken, amount]);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl w-full max-w-md">
      <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-4">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse"></span>
          MultiHopper Swap
        </h2>
        <div className="flex items-center gap-2 text-xs">
          <span className="text-slate-400">Slippage:</span>
          <select
            value={slippageBps}
            onChange={(e) => setSlippageBps(Number(e.target.value))}
            className="bg-slate-800 text-slate-200 border border-slate-700 rounded px-2 py-0.5 text-xs outline-none"
          >
            <option value={10}>0.1%</option>
            <option value={50}>0.5%</option>
            <option value={100}>1.0%</option>
            <option value={200}>2.0%</option>
          </select>
        </div>
      </div>

      {/* Input token container */}
      <div className="bg-slate-950 border border-slate-800 rounded-lg p-3.5 mb-2">
        <div className="flex justify-between text-xs text-slate-400 mb-1.5">
          <span>You Pay</span>
          <span>Balance: 12.450 {inputToken.symbol}</span>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.0"
            className="bg-transparent text-xl font-semibold text-white outline-none w-full"
          />
          <select
            value={inputToken.symbol}
            onChange={(e) => {
              const sel = TOKENS[e.target.value];
              if (sel) setInputToken(sel);
            }}
            className="bg-slate-800 text-white font-medium text-sm rounded-lg px-3 py-1.5 border border-slate-700 outline-none"
          >
            {Object.values(TOKENS).map((t) => (
              <option key={t.symbol} value={t.symbol}>
                {t.symbol}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Switch button */}
      <div className="flex justify-center -my-2 relative z-10">
        <button
          onClick={handleSwapTokens}
          className="bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 rounded-full p-2 transition shadow-md"
          title="Invert tokens"
        >
          ⇅
        </button>
      </div>

      {/* Output token container */}
      <div className="bg-slate-950 border border-slate-800 rounded-lg p-3.5 mt-2 mb-4">
        <div className="flex justify-between text-xs text-slate-400 mb-1.5">
          <span>You Receive (Estimated)</span>
          <span>Est. Value</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-xl font-semibold text-emerald-400 w-full overflow-hidden text-ellipsis">
            {isCalculating ? 'Computing...' : currentRoute ? formatTokenAmount(currentRoute.amountOut, outputToken.decimals) : '0.0'}
          </div>
          <select
            value={outputToken.symbol}
            onChange={(e) => {
              const sel = TOKENS[e.target.value];
              if (sel) setOutputToken(sel);
            }}
            className="bg-slate-800 text-white font-medium text-sm rounded-lg px-3 py-1.5 border border-slate-700 outline-none"
          >
            {Object.values(TOKENS).map((t) => (
              <option key={t.symbol} value={t.symbol}>
                {t.symbol}
              </option>
            ))}
          </select>
        </div>
      </div>

      {currentRoute && (
        <div className="text-xs text-slate-400 space-y-1.5 mb-4 p-3 bg-slate-950/40 rounded-lg border border-slate-800">
          <div className="flex justify-between">
            <span>Minimum Received:</span>
            <span className="text-slate-200">
              {formatTokenAmount(calculateMinimumAmountOut(currentRoute.amountOut, slippageBps), outputToken.decimals)}{' '}
              {outputToken.symbol}
            </span>
          </div>
          <div className="flex justify-between">
            <span>Route:</span>
            <span className="text-purple-400 font-medium">
              {currentRoute.hops.map((h: any) => h.dex).join(' ➔ ')}
            </span>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={onSimulateRequested}
          className="w-full py-2.5 px-4 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-sm font-semibold rounded-lg transition"
        >
          Profile CUs
        </button>
        <button
          onClick={calculateRoute}
          disabled={isCalculating}
          className="w-full py-2.5 px-4 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 text-sm font-bold rounded-lg shadow-lg transition disabled:opacity-50"
        >
          {isCalculating ? 'Routing...' : 'Execute Route'}
        </button>
      </div>
    </div>
  );
};
