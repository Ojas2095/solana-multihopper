import { describe, it, expect } from 'vitest';
import { MultiHopRouter, DEFAULT_POOLS, Pool } from '../src/core/graph.js';
import { TOKENS } from '../src/core/tokens.js';

describe('MultiHopRouter Graph Pathfinding', () => {
  const router = new MultiHopRouter(DEFAULT_POOLS);

  it('finds direct 1-hop path between SOL and USDC', () => {
    const amountIn = 1_000_000_000n; // 1 SOL
    const route = router.findBestRoute(TOKENS.SOL.mint, TOKENS.USDC.mint, amountIn, 1);

    expect(route).not.toBeNull();
    expect(route?.hops.length).toBe(1);
    expect(route?.hops[0].inputMint).toBe(TOKENS.SOL.mint);
    expect(route?.hops[0].outputMint).toBe(TOKENS.USDC.mint);
    expect(route?.amountOut).toBeGreaterThan(0n);
  });

  it('finds 2-hop route when no direct pool exists or multi-hop is better', () => {
    // Trade WIF for USDC (WIF has pool with SOL, SOL has pool with USDC)
    const amountIn = 10_000_000n; // 10 WIF (6 decimals)
    const route = router.findBestRoute(TOKENS.WIF.mint, TOKENS.USDC.mint, amountIn, 3);

    expect(route).not.toBeNull();
    expect(route?.hops.length).toBe(2);
    expect(route?.hops[0].inputMint).toBe(TOKENS.WIF.mint);
    expect(route?.hops[0].outputMint).toBe(TOKENS.SOL.mint);
    expect(route?.hops[1].inputMint).toBe(TOKENS.SOL.mint);
    expect(route?.hops[1].outputMint).toBe(TOKENS.USDC.mint);
  });

  it('strictly prevents cyclic loops (e.g. SOL -> USDC -> SOL)', () => {
    const amountIn = 1_000_000_000n;
    const allRoutes = router.findAllRoutes(TOKENS.SOL.mint, TOKENS.USDC.mint, amountIn, 3);

    allRoutes.forEach((route) => {
      const visitedTokens = new Set<string>();
      visitedTokens.add(route.inputMint.toLowerCase());

      route.hops.forEach((hop) => {
        const out = hop.outputMint.toLowerCase();
        // A token should not be visited twice in the same path
        expect(visitedTokens.has(out)).toBe(false);
        visitedTokens.add(out);
      });
    });
  });

  it('respects maxHops constraints', () => {
    const amountIn = 10_000_000n;
    // With maxHops = 1, WIF -> USDC cannot be resolved because no direct WIF/USDC pool exists
    const route1Hop = router.findBestRoute(TOKENS.WIF.mint, TOKENS.USDC.mint, amountIn, 1);
    expect(route1Hop).toBeNull();

    // With maxHops = 2, WIF -> SOL -> USDC resolves
    const route2Hop = router.findBestRoute(TOKENS.WIF.mint, TOKENS.USDC.mint, amountIn, 2);
    expect(route2Hop).not.toBeNull();
    expect(route2Hop?.hops.length).toBe(2);
  });

  it('optimizes pool selection: selects pool with highest output amount', () => {
    // Create custom test pools where Pool A has higher reserve than Pool B
    const customPools: Pool[] = [
      {
        id: 'pool-low-liq',
        dex: 'Raydium',
        tokenA: 'TOKEN_A',
        tokenB: 'TOKEN_B',
        reserveA: 1_000_000n,
        reserveB: 1_000_000n,
        feeBps: 30,
      },
      {
        id: 'pool-high-liq',
        dex: 'Orca',
        tokenA: 'TOKEN_A',
        tokenB: 'TOKEN_B',
        reserveA: 100_000_000n,
        reserveB: 100_000_000n,
        feeBps: 20, // Lower fee + higher liquidity
      },
    ];

    const customRouter = new MultiHopRouter(customPools);
    const bestRoute = customRouter.findBestRoute('TOKEN_A', 'TOKEN_B', 10_000n, 1);

    expect(bestRoute).not.toBeNull();
    expect(bestRoute?.hops[0].poolId).toBe('pool-high-liq');
    expect(bestRoute?.hops[0].dex).toBe('Orca');
  });
});
