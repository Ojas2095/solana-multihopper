import Decimal from 'decimal.js';

/**
 * Constant Product AMM Math (x * y = k)
 * Handles fee deduction, price impact, and slippage calculations.
 */

export interface SwapMathResult {
  amountOut: bigint;
  spotPrice: number;
  executionPrice: number;
  priceImpactPct: number;
  feeAmount: bigint;
}

/**
 * Calculates output amount for constant product AMM with trading fee.
 * amountInWithFee = amountIn * (10000 - feeBps)
 * amountOut = (amountInWithFee * reserveOut) / (reserveIn * 10000 + amountInWithFee)
 */
export function getAmountOut(
  amountIn: bigint,
  reserveIn: bigint,
  reserveOut: bigint,
  feeBps: number = 25 // Default 25 bps (0.25%)
): SwapMathResult {
  if (amountIn <= 0n) {
    throw new Error('amountIn must be strictly positive');
  }
  if (reserveIn <= 0n || reserveOut <= 0n) {
    throw new Error('Reserves must be strictly positive');
  }
  if (feeBps < 0 || feeBps >= 10000) {
    throw new Error('feeBps must be between 0 and 9999');
  }

  const feeMultiplier = BigInt(10000 - feeBps);
  const amountInWithFee = amountIn * feeMultiplier;
  const numerator = amountInWithFee * reserveOut;
  const denominator = reserveIn * 10000n + amountInWithFee;
  const amountOut = numerator / denominator;

  if (amountOut >= reserveOut) {
    throw new Error('Insufficient pool liquidity for requested trade size');
  }

  const feeAmount = (amountIn * BigInt(feeBps)) / 10000n;

  // Precision math for prices and price impact
  const dReserveIn = new Decimal(reserveIn.toString());
  const dReserveOut = new Decimal(reserveOut.toString());
  const dAmountIn = new Decimal(amountIn.toString());
  const dAmountOut = new Decimal(amountOut.toString());

  // Spot price: reserveOut / reserveIn (units of out per unit of in)
  const spotPrice = dReserveOut.div(dReserveIn).toNumber();

  // Execution price: actual out received per unit of in
  const executionPrice = dAmountOut.div(dAmountIn).toNumber();

  // Price impact: (spotPrice - executionPrice) / spotPrice * 100
  const impact = new Decimal(spotPrice)
    .minus(executionPrice)
    .div(spotPrice)
    .mul(100)
    .toNumber();

  const priceImpactPct = Math.max(0, Number(impact.toFixed(4)));

  return {
    amountOut,
    spotPrice,
    executionPrice,
    priceImpactPct,
    feeAmount,
  };
}

/**
 * Inverse calculation: calculates required input amount for a desired output amount.
 */
export function getAmountIn(
  amountOut: bigint,
  reserveIn: bigint,
  reserveOut: bigint,
  feeBps: number = 25
): bigint {
  if (amountOut <= 0n) {
    throw new Error('amountOut must be strictly positive');
  }
  if (reserveIn <= 0n || reserveOut <= 0n) {
    throw new Error('Reserves must be strictly positive');
  }
  if (amountOut >= reserveOut) {
    throw new Error('amountOut exceeds reserveOut');
  }

  const numerator = reserveIn * amountOut * 10000n;
  const denominator = (reserveOut - amountOut) * BigInt(10000 - feeBps);
  return numerator / denominator + 1n;
}

/**
 * Calculates minimum amount out after applying slippage tolerance in basis points.
 * E.g., slippageBps = 50 (0.50% slippage)
 */
export function calculateMinimumAmountOut(amountOut: bigint, slippageBps: number): bigint {
  if (slippageBps < 0 || slippageBps > 10000) {
    throw new Error('slippageBps must be between 0 and 10000');
  }
  const minMultiplier = BigInt(10000 - slippageBps);
  return (amountOut * minMultiplier) / 10000n;
}

/**
 * Computes cumulative price impact across a multi-hop sequence.
 */
export function computeCumulativePriceImpact(hopImpacts: number[]): number {
  if (hopImpacts.length === 0) return 0;
  // (1 - (1 - i1)(1 - i2)...) * 100
  let multiplier = new Decimal(1);
  for (const impact of hopImpacts) {
    const retained = new Decimal(1).minus(new Decimal(impact).div(100));
    multiplier = multiplier.mul(retained);
  }
  const cumulative = new Decimal(1).minus(multiplier).mul(100).toNumber();
  return Math.max(0, Number(cumulative.toFixed(4)));
}
