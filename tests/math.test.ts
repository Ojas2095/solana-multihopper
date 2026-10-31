import { describe, it, expect } from 'vitest';
import {
  getAmountOut,
  getAmountIn,
  calculateMinimumAmountOut,
  computeCumulativePriceImpact,
} from '../src/core/math.js';

describe('Constant Product AMM Math (x * y = k)', () => {
  const reserveIn = 1_000_000_000_000n; // 1,000 SOL (9 decimals)
  const reserveOut = 160_000_000_000n;  // 160,000 USDC (6 decimals)
  const feeBps = 25; // 0.25%

  it('calculates amountOut correctly according to invariant with fee', () => {
    const amountIn = 1_000_000_000n; // 1 SOL
    const result = getAmountOut(amountIn, reserveIn, reserveOut, feeBps);

    expect(result.amountOut).toBeGreaterThan(0n);
    // Spot price: 160 USDC/SOL
    expect(result.spotPrice).toBeCloseTo(0.16, 4);
    // Execution price should be slightly lower due to fee & impact
    expect(result.executionPrice).toBeLessThanOrEqual(result.spotPrice);
    expect(result.priceImpactPct).toBeGreaterThan(0);
    expect(result.feeAmount).toBe((amountIn * 25n) / 10000n);
  });

  it('exhibits price impact monotonicity: larger trade produces higher price impact', () => {
    const smallTrade = 1_000_000_000n; // 1 SOL
    const mediumTrade = 50_000_000_000n; // 50 SOL
    const largeTrade = 200_000_000_000n; // 200 SOL

    const resSmall = getAmountOut(smallTrade, reserveIn, reserveOut, feeBps);
    const resMed = getAmountOut(mediumTrade, reserveIn, reserveOut, feeBps);
    const resLarge = getAmountOut(largeTrade, reserveIn, reserveOut, feeBps);

    expect(resMed.priceImpactPct).toBeGreaterThan(resSmall.priceImpactPct);
    expect(resLarge.priceImpactPct).toBeGreaterThan(resMed.priceImpactPct);
  });

  it('reverses amountOut via getAmountIn accurately', () => {
    const amountIn = 5_000_000_000n;
    const { amountOut } = getAmountOut(amountIn, reserveIn, reserveOut, feeBps);
    const calculatedIn = getAmountIn(amountOut, reserveIn, reserveOut, feeBps);

    // In integer division with fee deduction, calculatedIn is within tiny rounding tolerance (< 10 units out of 5B)
    const diff = calculatedIn > amountIn ? calculatedIn - amountIn : amountIn - calculatedIn;
    expect(diff).toBeLessThanOrEqual(10n);
  });

  it('calculates minimum amount out with slippage bounds', () => {
    const amountOut = 1_000_000n;
    const slippage50Bps = 50; // 0.5%
    const minOut = calculateMinimumAmountOut(amountOut, slippage50Bps);

    // 1,000,000 * 0.995 = 995,000
    expect(minOut).toBe(995_000n);
  });

  it('computes cumulative price impact across multi-hop compounding', () => {
    const hop1Impact = 0.5; // 0.5%
    const hop2Impact = 1.0; // 1.0%
    const cumulative = computeCumulativePriceImpact([hop1Impact, hop2Impact]);

    // (1 - (1 - 0.005) * (1 - 0.01)) * 100 = 1.495%
    expect(cumulative).toBeCloseTo(1.495, 2);
  });

  it('throws on non-positive input or empty reserves', () => {
    expect(() => getAmountOut(0n, reserveIn, reserveOut)).toThrow();
    expect(() => getAmountOut(-10n, reserveIn, reserveOut)).toThrow();
    expect(() => getAmountOut(100n, 0n, reserveOut)).toThrow();
  });
});
