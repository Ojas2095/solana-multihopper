import { describe, it, expect } from 'vitest';
import { JupiterClient } from '../src/jupiter/client.js';
import { MultiHopRouter } from '../src/core/graph.js';
import { TOKENS } from '../src/core/tokens.js';

describe('Jupiter v6 Client & Comparator', () => {
  const jup = new JupiterClient();
  const router = new MultiHopRouter();

  it('retrieves or simulates valid Jupiter v6 quote', async () => {
    const amount = '1000000000'; // 1 SOL
    const quote = await jup.getQuote(TOKENS.SOL.mint, TOKENS.USDC.mint, amount, 50);

    expect(quote).toBeDefined();
    expect(quote.inputMint).toBe(TOKENS.SOL.mint);
    expect(quote.outputMint).toBe(TOKENS.USDC.mint);
    expect(BigInt(quote.outAmount)).toBeGreaterThan(0n);
    expect(quote.routePlan.length).toBeGreaterThan(0);
  });

  it('performs comparative quote analysis against custom multi-hop route', async () => {
    const amountIn = 1_000_000_000n; // 1 SOL
    const customRoute = router.findBestRoute(TOKENS.SOL.mint, TOKENS.USDC.mint, amountIn, 2);
    expect(customRoute).not.toBeNull();

    const jupQuote = await jup.getQuote(TOKENS.SOL.mint, TOKENS.USDC.mint, amountIn.toString(), 50);
    const comparison = jup.compareQuotes(customRoute!, jupQuote);

    expect(comparison.inputMint).toBe(TOKENS.SOL.mint);
    expect(comparison.outputMint).toBe(TOKENS.USDC.mint);
    expect(typeof comparison.outDifferencePct).toBe('number');
    expect(['MultiHopper', 'Jupiter']).toContain(comparison.recommendedEngine);
  });

  it('handles versioned swap transaction requests gracefully', async () => {
    const quote = await jup.getQuote(TOKENS.SOL.mint, TOKENS.USDC.mint, '1000000000', 50);
    const swapRes = await jup.getSwapTransaction({
      userPublicKey: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
      quoteResponse: quote,
    });

    expect(swapRes.swapTransaction).toBeDefined();
    expect(swapRes.lastValidBlockHeight).toBeGreaterThan(0);
  });
});
