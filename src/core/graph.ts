import { getAmountOut, computeCumulativePriceImpact } from './math.js';
import { TOKENS, getTokenByMint } from './tokens.js';

export interface Pool {
  id: string;
  dex: 'Raydium' | 'Orca' | 'Meteora';
  tokenA: string; // Mint address
  tokenB: string; // Mint address
  reserveA: bigint;
  reserveB: bigint;
  feeBps: number;
}

export interface RouteHop {
  poolId: string;
  dex: 'Raydium' | 'Orca' | 'Meteora';
  inputMint: string;
  outputMint: string;
  amountIn: bigint;
  amountOut: bigint;
  spotPrice: number;
  executionPrice: number;
  priceImpactPct: number;
  feeBps: number;
}

export interface RoutePlan {
  inputMint: string;
  outputMint: string;
  amountIn: bigint;
  amountOut: bigint;
  hops: RouteHop[];
  cumulativePriceImpactPct: number;
  totalFeeBps: number;
  executionTimeMs: number;
}

/**
 * Standard Solana DEX pool registry with representative mainnet liquidity tiers.
 */
export const DEFAULT_POOLS: Pool[] = [
  // Raydium SOL-USDC (Deep liquidity)
  {
    id: 'raydium-sol-usdc',
    dex: 'Raydium',
    tokenA: TOKENS.SOL.mint,
    tokenB: TOKENS.USDC.mint,
    reserveA: 1_500_000n * 1_000_000_000n, // 1.5M SOL
    reserveB: 240_000_000n * 1_000_000n,    // 240M USDC (~$160/SOL)
    feeBps: 25,
  },
  // Orca Whirlpool SOL-USDC
  {
    id: 'orca-sol-usdc',
    dex: 'Orca',
    tokenA: TOKENS.SOL.mint,
    tokenB: TOKENS.USDC.mint,
    reserveA: 1_200_000n * 1_000_000_000n, // 1.2M SOL
    reserveB: 192_000_000n * 1_000_000n,    // 192M USDC
    feeBps: 20, // 0.20% fee tier
  },
  // Meteora Dynamic SOL-USDT
  {
    id: 'meteora-sol-usdt',
    dex: 'Meteora',
    tokenA: TOKENS.SOL.mint,
    tokenB: TOKENS.USDT.mint,
    reserveA: 400_000n * 1_000_000_000n,  // 400k SOL
    reserveB: 64_000_000n * 1_000_000n,   // 64M USDT
    feeBps: 30,
  },
  // Raydium USDC-USDT Stable pair
  {
    id: 'raydium-usdc-usdt',
    dex: 'Raydium',
    tokenA: TOKENS.USDC.mint,
    tokenB: TOKENS.USDT.mint,
    reserveA: 80_000_000n * 1_000_000n,
    reserveB: 80_000_000n * 1_000_000n,
    feeBps: 4, // 0.04% stable fee
  },
  // Raydium SOL-BONK
  {
    id: 'raydium-sol-bonk',
    dex: 'Raydium',
    tokenA: TOKENS.SOL.mint,
    tokenB: TOKENS.BONK.mint,
    reserveA: 350_000n * 1_000_000_000n,
    reserveB: 2_800_000_000_000n * 100_000n, // BONK (5 decimals)
    feeBps: 25,
  },
  // Orca BONK-USDC
  {
    id: 'orca-bonk-usdc',
    dex: 'Orca',
    tokenA: TOKENS.BONK.mint,
    tokenB: TOKENS.USDC.mint,
    reserveA: 1_500_000_000_000n * 100_000n,
    reserveB: 30_000_000n * 1_000_000n,
    feeBps: 30,
  },
  // Raydium SOL-JUP
  {
    id: 'raydium-sol-jup',
    dex: 'Raydium',
    tokenA: TOKENS.SOL.mint,
    tokenB: TOKENS.JUP.mint,
    reserveA: 200_000n * 1_000_000_000n,
    reserveB: 35_000_000n * 1_000_000n,
    feeBps: 25,
  },
  // Orca JUP-USDC
  {
    id: 'orca-jup-usdc',
    dex: 'Orca',
    tokenA: TOKENS.JUP.mint,
    tokenB: TOKENS.USDC.mint,
    reserveA: 25_000_000n * 1_000_000n,
    reserveB: 22_500_000n * 1_000_000n,
    feeBps: 25,
  },
  // Raydium SOL-RAY
  {
    id: 'raydium-sol-ray',
    dex: 'Raydium',
    tokenA: TOKENS.SOL.mint,
    tokenB: TOKENS.RAY.mint,
    reserveA: 150_000n * 1_000_000_000n,
    reserveB: 12_000_000n * 1_000_000n,
    feeBps: 25,
  },
  // Orca RAY-USDC
  {
    id: 'orca-ray-usdc',
    dex: 'Orca',
    tokenA: TOKENS.RAY.mint,
    tokenB: TOKENS.USDC.mint,
    reserveA: 10_000_000n * 1_000_000n,
    reserveB: 20_000_000n * 1_000_000n,
    feeBps: 30,
  },
  // Raydium SOL-WIF
  {
    id: 'raydium-sol-wif',
    dex: 'Raydium',
    tokenA: TOKENS.SOL.mint,
    tokenB: TOKENS.WIF.mint,
    reserveA: 300_000n * 1_000_000_000n,
    reserveB: 20_000_000n * 1_000_000n,
    feeBps: 25,
  },
];

export class MultiHopRouter {
  private pools: Pool[];

  constructor(pools: Pool[] = DEFAULT_POOLS) {
    this.pools = pools;
  }

  public getPools(): Pool[] {
    return this.pools;
  }

  public addPool(pool: Pool): void {
    this.pools.push(pool);
  }

  /**
   * Finds the optimal trading route between inputMint and outputMint.
   * Explores all paths up to maxHops, avoids cycles, and calculates accurate
   * constant product outputs and price impacts.
   */
  public findBestRoute(
    inputMint: string,
    outputMint: string,
    amountIn: bigint,
    maxHops: number = 3
  ): RoutePlan | null {
    const startTime = performance.now();

    if (inputMint.toLowerCase() === outputMint.toLowerCase()) {
      throw new Error('Input mint and output mint must be distinct');
    }
    if (amountIn <= 0n) {
      throw new Error('amountIn must be positive');
    }
    if (maxHops < 1) {
      throw new Error('maxHops must be at least 1');
    }

    const candidateRoutes: RoutePlan[] = [];

    // Depth-First Search for valid non-cyclic paths up to maxHops
    const dfs = (
      currentMint: string,
      currentAmount: bigint,
      visitedMints: Set<string>,
      currentHops: RouteHop[],
      remainingHops: number
    ) => {
      if (currentMint.toLowerCase() === outputMint.toLowerCase() && currentHops.length > 0) {
        const cumulativeImpact = computeCumulativePriceImpact(
          currentHops.map((h) => h.priceImpactPct)
        );
        const totalFee = currentHops.reduce((sum, h) => sum + h.feeBps, 0);

        candidateRoutes.push({
          inputMint,
          outputMint,
          amountIn,
          amountOut: currentAmount,
          hops: [...currentHops],
          cumulativePriceImpactPct: cumulativeImpact,
          totalFeeBps: totalFee,
          executionTimeMs: 0,
        });
        return;
      }

      if (remainingHops <= 0) {
        return;
      }

      // Find all pools connected to currentMint
      for (const pool of this.pools) {
        const isA = pool.tokenA.toLowerCase() === currentMint.toLowerCase();
        const isB = pool.tokenB.toLowerCase() === currentMint.toLowerCase();
        if (!isA && !isB) continue;

        const nextMint = isA ? pool.tokenB : pool.tokenA;
        if (visitedMints.has(nextMint.toLowerCase())) {
          // Prevent cycle
          continue;
        }

        const reserveIn = isA ? pool.reserveA : pool.reserveB;
        const reserveOut = isA ? pool.reserveB : pool.reserveA;

        try {
          const mathResult = getAmountOut(
            currentAmount,
            reserveIn,
            reserveOut,
            pool.feeBps
          );

          if (mathResult.amountOut <= 0n) continue;

          const hop: RouteHop = {
            poolId: pool.id,
            dex: pool.dex,
            inputMint: currentMint,
            outputMint: nextMint,
            amountIn: currentAmount,
            amountOut: mathResult.amountOut,
            spotPrice: mathResult.spotPrice,
            executionPrice: mathResult.executionPrice,
            priceImpactPct: mathResult.priceImpactPct,
            feeBps: pool.feeBps,
          };

          visitedMints.add(nextMint.toLowerCase());
          currentHops.push(hop);

          dfs(
            nextMint,
            mathResult.amountOut,
            visitedMints,
            currentHops,
            remainingHops - 1
          );

          // Backtrack
          currentHops.pop();
          visitedMints.delete(nextMint.toLowerCase());
        } catch {
          // Skip pools where trade exceeds liquidity
          continue;
        }
      }
    };

    const initialVisited = new Set<string>([inputMint.toLowerCase()]);
    dfs(inputMint, amountIn, initialVisited, [], maxHops);

    if (candidateRoutes.length === 0) {
      return null;
    }

    // Sort routes by maximum amountOut descending
    candidateRoutes.sort((a, b) => {
      if (b.amountOut > a.amountOut) return 1;
      if (b.amountOut < a.amountOut) return -1;
      // If equal output, prefer fewer hops
      return a.hops.length - b.hops.length;
    });

    const best = candidateRoutes[0];
    best.executionTimeMs = Math.round(performance.now() - startTime);
    return best;
  }

  /**
   * Evaluates all possible paths and returns ranked top N routes.
   */
  public findAllRoutes(
    inputMint: string,
    outputMint: string,
    amountIn: bigint,
    maxHops: number = 3,
    limit: number = 5
  ): RoutePlan[] {
    const startTime = performance.now();
    const candidateRoutes: RoutePlan[] = [];

    const dfs = (
      currentMint: string,
      currentAmount: bigint,
      visitedMints: Set<string>,
      currentHops: RouteHop[],
      remainingHops: number
    ) => {
      if (currentMint.toLowerCase() === outputMint.toLowerCase() && currentHops.length > 0) {
        const cumulativeImpact = computeCumulativePriceImpact(
          currentHops.map((h) => h.priceImpactPct)
        );
        const totalFee = currentHops.reduce((sum, h) => sum + h.feeBps, 0);

        candidateRoutes.push({
          inputMint,
          outputMint,
          amountIn,
          amountOut: currentAmount,
          hops: [...currentHops],
          cumulativePriceImpactPct: cumulativeImpact,
          totalFeeBps: totalFee,
          executionTimeMs: 0,
        });
        return;
      }

      if (remainingHops <= 0) return;

      for (const pool of this.pools) {
        const isA = pool.tokenA.toLowerCase() === currentMint.toLowerCase();
        const isB = pool.tokenB.toLowerCase() === currentMint.toLowerCase();
        if (!isA && !isB) continue;

        const nextMint = isA ? pool.tokenB : pool.tokenA;
        if (visitedMints.has(nextMint.toLowerCase())) continue;

        const reserveIn = isA ? pool.reserveA : pool.reserveB;
        const reserveOut = isA ? pool.reserveB : pool.reserveA;

        try {
          const mathResult = getAmountOut(
            currentAmount,
            reserveIn,
            reserveOut,
            pool.feeBps
          );
          if (mathResult.amountOut <= 0n) continue;

          const hop: RouteHop = {
            poolId: pool.id,
            dex: pool.dex,
            inputMint: currentMint,
            outputMint: nextMint,
            amountIn: currentAmount,
            amountOut: mathResult.amountOut,
            spotPrice: mathResult.spotPrice,
            executionPrice: mathResult.executionPrice,
            priceImpactPct: mathResult.priceImpactPct,
            feeBps: pool.feeBps,
          };

          visitedMints.add(nextMint.toLowerCase());
          currentHops.push(hop);
          dfs(nextMint, mathResult.amountOut, visitedMints, currentHops, remainingHops - 1);
          currentHops.pop();
          visitedMints.delete(nextMint.toLowerCase());
        } catch {
          continue;
        }
      }
    };

    dfs(inputMint, amountIn, new Set([inputMint.toLowerCase()]), [], maxHops);

    candidateRoutes.sort((a, b) => (b.amountOut > a.amountOut ? 1 : -1));
    const totalTime = Math.round(performance.now() - startTime);
    return candidateRoutes.slice(0, limit).map((r) => ({
      ...r,
      executionTimeMs: totalTime,
    }));
  }
}
