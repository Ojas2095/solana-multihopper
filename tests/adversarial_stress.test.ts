import { describe, it, expect } from 'vitest';
import { MultiHopRouter, Pool } from '../src/core/graph.js';
import { getAmountOut, getAmountIn, calculateMinimumAmountOut, computeCumulativePriceImpact } from '../src/core/math.js';
import { TOKENS } from '../src/core/tokens.js';

describe('Tier 5 Adversarial Stress Testing — MultiHopper Routing Engine', () => {
  // 1. Cyclic Graph Scenarios
  describe('Cyclic Graph Stress Testing', () => {
    it('handles direct self-loop pool (tokenA === tokenB) gracefully without infinite loop', () => {
      const selfLoopPools: Pool[] = [
        {
          id: 'self-loop-pool',
          dex: 'Raydium',
          tokenA: TOKENS.SOL.mint,
          tokenB: TOKENS.SOL.mint,
          reserveA: 1_000_000_000_000n,
          reserveB: 1_000_000_000_000n,
          feeBps: 25,
        },
        {
          id: 'legit-sol-usdc',
          dex: 'Orca',
          tokenA: TOKENS.SOL.mint,
          tokenB: TOKENS.USDC.mint,
          reserveA: 1_000_000_000_000n,
          reserveB: 150_000_000_000n,
          feeBps: 20,
        },
      ];

      const router = new MultiHopRouter(selfLoopPools);
      const route = router.findBestRoute(TOKENS.SOL.mint, TOKENS.USDC.mint, 1_000_000_000n, 3);

      expect(route).not.toBeNull();
      expect(route?.hops.length).toBe(1);
      expect(route?.hops[0].poolId).toBe('legit-sol-usdc');
    });

    it('terminates DFS correctly in cyclic triangle graph (A -> B -> C -> A)', () => {
      const tokenA = 'TokenAAAA11111111111111111111111111111111111';
      const tokenB = 'TokenBBBB22222222222222222222222222222222222';
      const tokenC = 'TokenCCCC33333333333333333333333333333333333';
      const tokenD = 'TokenDDDD44444444444444444444444444444444444';

      const trianglePools: Pool[] = [
        { id: 'p1', dex: 'Raydium', tokenA, tokenB, reserveA: 10_000_000n, reserveB: 10_000_000n, feeBps: 25 },
        { id: 'p2', dex: 'Orca', tokenA: tokenB, tokenB: tokenC, reserveA: 10_000_000n, reserveB: 10_000_000n, feeBps: 25 },
        { id: 'p3', dex: 'Meteora', tokenA: tokenC, tokenB: tokenA, reserveA: 10_000_000n, reserveB: 10_000_000n, feeBps: 25 },
        { id: 'p4', dex: 'Raydium', tokenA: tokenC, tokenB: tokenD, reserveA: 10_000_000n, reserveB: 10_000_000n, feeBps: 25 },
      ];

      const router = new MultiHopRouter(trianglePools);
      const allRoutes = router.findAllRoutes(tokenA, tokenD, 1_000n, 5, 10);

      expect(allRoutes.length).toBeGreaterThan(0);
      allRoutes.forEach((route) => {
        const visited = new Set<string>();
        visited.add(route.inputMint);
        route.hops.forEach((hop) => {
          expect(visited.has(hop.outputMint)).toBe(false); // No cycles in candidate paths
          visited.add(hop.outputMint);
        });
      });
    });

    it('survives dense complete bipartite graph without exponential explosion or timeout', () => {
      // 4 inputs and 4 outputs fully connected (16 pools)
      const set1 = ['T1A', 'T1B', 'T1C', 'T1D'];
      const set2 = ['T2A', 'T2B', 'T2C', 'T2D'];
      const pools: Pool[] = [];

      let idCounter = 1;
      for (const t1 of set1) {
        for (const t2 of set2) {
          pools.push({
            id: `clique-${idCounter++}`,
            dex: 'Raydium',
            tokenA: t1,
            tokenB: t2,
            reserveA: 100_000_000n,
            reserveB: 100_000_000n,
            feeBps: 30,
          });
        }
      }

      const router = new MultiHopRouter(pools);
      const startTime = performance.now();
      const route = router.findBestRoute('T1A', 'T1D', 10_000n, 3);
      const durationMs = performance.now() - startTime;

      expect(durationMs).toBeLessThan(1000); // Must resolve well under 1 second
      expect(route).not.toBeNull();
      expect(route?.hops.length).toBe(2); // T1A -> T2X -> T1D
    });
  });

  // 2. Degenerate Pool Reserves & Division by Zero Protection
  describe('Zero and Degenerate Reserves', () => {
    it('throws descriptive error on zero reserve in getAmountOut', () => {
      expect(() => getAmountOut(100n, 0n, 1000n, 25)).toThrow(/Reserves must be strictly positive/);
      expect(() => getAmountOut(100n, 1000n, 0n, 25)).toThrow(/Reserves must be strictly positive/);
    });

    it('throws descriptive error on negative reserve in getAmountOut', () => {
      expect(() => getAmountOut(100n, -500n, 1000n, 25)).toThrow(/Reserves must be strictly positive/);
      expect(() => getAmountOut(100n, 1000n, -500n, 25)).toThrow(/Reserves must be strictly positive/);
    });

    it('router gracefully skips zero-reserve and corrupted pools in graph', () => {
      const corruptedPools: Pool[] = [
        {
          id: 'dead-pool-zero-a',
          dex: 'Raydium',
          tokenA: 'DEAD1',
          tokenB: 'DEAD2',
          reserveA: 0n,
          reserveB: 10_000_000n,
          feeBps: 25,
        },
        {
          id: 'dead-pool-zero-b',
          dex: 'Orca',
          tokenA: 'DEAD1',
          tokenB: 'DEAD2',
          reserveA: 10_000_000n,
          reserveB: 0n,
          feeBps: 25,
        },
        {
          id: 'working-pool',
          dex: 'Meteora',
          tokenA: 'DEAD1',
          tokenB: 'DEAD2',
          reserveA: 50_000_000n,
          reserveB: 50_000_000n,
          feeBps: 25,
        },
      ];

      const router = new MultiHopRouter(corruptedPools);
      const route = router.findBestRoute('DEAD1', 'DEAD2', 10_000n, 1);

      expect(route).not.toBeNull();
      expect(route?.hops[0].poolId).toBe('working-pool');
    });
  });

  // 3. Trade Size Boundaries & Extreme Price Impact
  describe('Extreme Trade Sizes & Price Impact', () => {
    it('rejects trade exceeding pool output reserves', () => {
      const reserveIn = 1_000_000n;
      const reserveOut = 1_000n;
      // Massive input that mathematically seeks > 100% of reserveOut
      const amountIn = 100_000_000_000_000n;

      // In AMM x*y=k, amountOut = (amountInWithFee * reserveOut) / (reserveIn*10000 + amountInWithFee)
      // As amountIn -> infinity, amountOut approaches reserveOut
      const result = getAmountOut(amountIn, reserveIn, reserveOut, 25);
      expect(result.amountOut).toBeLessThan(reserveOut);
      expect(result.priceImpactPct).toBeGreaterThan(99.0);
    });

    it('handles micro-trades where fee or truncation yields 0 amountOut', () => {
      // Input = 1 lamport, reserveIn = 10^18 lamports, reserveOut = 100 lamports
      // amountOut mathematically is 0
      const result = getAmountOut(1n, 1_000_000_000_000_000_000n, 100n, 25);
      expect(result.amountOut).toBe(0n);
    });

    it('router skips paths where trade outputs 0 tokens', () => {
      const microPools: Pool[] = [
        {
          id: 'micro-dust-pool',
          dex: 'Raydium',
          tokenA: 'T_IN',
          tokenB: 'T_OUT',
          reserveA: 1_000_000_000_000_000_000n,
          reserveB: 10n,
          feeBps: 9000,
        },
      ];

      const router = new MultiHopRouter(microPools);
      // 1 unit input in dust pool yields 0 output -> router should return null
      const route = router.findBestRoute('T_IN', 'T_OUT', 1n, 1);
      expect(route).toBeNull();
    });

    it('computes cumulative price impact correctly across 3 hops with extreme impact', () => {
      const impacts = [50.0, 50.0, 50.0];
      // (1 - 0.5 * 0.5 * 0.5) * 100 = (1 - 0.125) * 100 = 87.5%
      const cumulative = computeCumulativePriceImpact(impacts);
      expect(cumulative).toBe(87.5);
    });
  });

  // 4. Slippage Math Boundary Testing
  describe('Slippage Math Boundaries', () => {
    it('returns exact amountOut when slippage is 0 bps', () => {
      const minOut = calculateMinimumAmountOut(1_000_000n, 0);
      expect(minOut).toBe(1_000_000n);
    });

    it('returns 0n when slippage is 10000 bps (100%)', () => {
      const minOut = calculateMinimumAmountOut(1_000_000n, 10000);
      expect(minOut).toBe(0n);
    });

    it('throws error when slippageBps is negative or exceeds 10000', () => {
      expect(() => calculateMinimumAmountOut(1_000_000n, -1)).toThrow(/slippageBps must be between 0 and 10000/);
      expect(() => calculateMinimumAmountOut(1_000_000n, 10001)).toThrow(/slippageBps must be between 0 and 10000/);
    });
  });

  // 5. Input Validation & Disconnected Graph Boundaries
  describe('Graph Routing Boundaries', () => {
    it('throws error when inputMint equals outputMint', () => {
      const router = new MultiHopRouter();
      expect(() => router.findBestRoute(TOKENS.SOL.mint, TOKENS.SOL.mint, 1000n, 3)).toThrow(
        /Input mint and output mint must be distinct/
      );
    });

    it('throws error when amountIn is zero or negative', () => {
      const router = new MultiHopRouter();
      expect(() => router.findBestRoute(TOKENS.SOL.mint, TOKENS.USDC.mint, 0n, 3)).toThrow(
        /amountIn must be positive/
      );
      expect(() => router.findBestRoute(TOKENS.SOL.mint, TOKENS.USDC.mint, -100n, 3)).toThrow(
        /amountIn must be positive/
      );
    });

    it('throws error when maxHops is less than 1', () => {
      const router = new MultiHopRouter();
      expect(() => router.findBestRoute(TOKENS.SOL.mint, TOKENS.USDC.mint, 1000n, 0)).toThrow(
        /maxHops must be at least 1/
      );
      expect(() => router.findBestRoute(TOKENS.SOL.mint, TOKENS.USDC.mint, 1000n, -2)).toThrow(
        /maxHops must be at least 1/
      );
    });

    it('returns null when tokens are in completely disconnected subgraphs', () => {
      const islandPools: Pool[] = [
        { id: 'island-1', dex: 'Raydium', tokenA: 'ISLAND1_A', tokenB: 'ISLAND1_B', reserveA: 10_000n, reserveB: 10_000n, feeBps: 25 },
        { id: 'island-2', dex: 'Orca', tokenA: 'ISLAND2_A', tokenB: 'ISLAND2_B', reserveA: 10_000n, reserveB: 10_000n, feeBps: 25 },
      ];

      const router = new MultiHopRouter(islandPools);
      const route = router.findBestRoute('ISLAND1_A', 'ISLAND2_B', 100n, 5);
      expect(route).toBeNull();
    });

    it('returns null when route requires more hops than maxHops limit', () => {
      // Chain: A -> B -> C -> D -> E (requires 4 hops)
      const chainPools: Pool[] = [
        { id: 'ab', dex: 'Raydium', tokenA: 'CH_A', tokenB: 'CH_B', reserveA: 1_000_000n, reserveB: 1_000_000n, feeBps: 10 },
        { id: 'bc', dex: 'Raydium', tokenA: 'CH_B', tokenB: 'CH_C', reserveA: 1_000_000n, reserveB: 1_000_000n, feeBps: 10 },
        { id: 'cd', dex: 'Raydium', tokenA: 'CH_C', tokenB: 'CH_D', reserveA: 1_000_000n, reserveB: 1_000_000n, feeBps: 10 },
        { id: 'de', dex: 'Raydium', tokenA: 'CH_D', tokenB: 'CH_E', reserveA: 1_000_000n, reserveB: 1_000_000n, feeBps: 10 },
      ];

      const router = new MultiHopRouter(chainPools);

      // maxHops = 3 should fail
      const route3Hops = router.findBestRoute('CH_A', 'CH_E', 1_000n, 3);
      expect(route3Hops).toBeNull();

      // maxHops = 4 should succeed
      const route4Hops = router.findBestRoute('CH_A', 'CH_E', 1_000n, 4);
      expect(route4Hops).not.toBeNull();
      expect(route4Hops?.hops.length).toBe(4);
    });
  });

  // 6. Extreme Fee Tiers
  describe('Extreme Fee Tiers', () => {
    it('handles zero-fee pool (feeBps = 0) accurately', () => {
      const res = getAmountOut(1000n, 100_000n, 100_000n, 0);
      expect(res.feeAmount).toBe(0n);
      // amountOut = (1000 * 10000 * 100000) / (100000 * 10000 + 1000 * 10000) = 100000000 / 1010000 = 990n
      expect(res.amountOut).toBe(990n);
    });

    it('handles maximum legal fee tier (feeBps = 9999) without overflow', () => {
      const res = getAmountOut(100_000n, 1_000_000n, 1_000_000n, 9999);
      expect(res.amountOut).toBeLessThan(100n);
    });

    it('rejects feeBps >= 10000 or negative feeBps', () => {
      expect(() => getAmountOut(1000n, 100_000n, 100_000n, 10000)).toThrow(/feeBps must be between 0 and 9999/);
      expect(() => getAmountOut(1000n, 100_000n, 100_000n, -5)).toThrow(/feeBps must be between 0 and 9999/);
    });
  });

  // 7. Astronomical Liquidity Reserves (BigInt scaling)
  describe('Astronomical Reserve Scaling', () => {
    it('handles 100-billion-token reserves without BigInt overflow or truncation failure', () => {
      const giantReserve = 100_000_000_000n * 1_000_000_000n; // 100B SOL
      const giantInput = 1_000_000n * 1_000_000_000n;        // 1M SOL trade

      const result = getAmountOut(giantInput, giantReserve, giantReserve, 25);
      expect(result.amountOut).toBeGreaterThan(0n);
      expect(result.amountOut).toBeLessThan(giantInput);
    });
  });
});
