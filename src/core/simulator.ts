import { Connection, VersionedTransaction, Transaction, SimulatedTransactionResponse } from '@solana/web3.js';
import { RoutePlan } from './graph.js';

export interface SimulationProfile {
  success: boolean;
  unitsConsumed: number;
  computeUnitLimit: number;
  recommendedPriorityFeeMicroLamports: number;
  estimatedFeeLamports: number;
  logs: string[];
  error?: string;
  hopBreakdown: {
    hopIndex: number;
    dex: string;
    estimatedUnits: number;
  }[];
}

export class TransactionSimulator {
  private connection?: Connection;

  constructor(rpcUrl?: string) {
    if (rpcUrl) {
      this.connection = new Connection(rpcUrl, 'confirmed');
    }
  }

  /**
   * Profiles expected compute units for a multi-hop route.
   * Standard Solana AMM swaps require:
   * - Base overhead: ~30,000 CU (transaction envelope, token balance checks)
   * - Raydium swap instruction: ~55,000 CU
   * - Orca Whirlpool swap instruction: ~65,000 CU
   * - Meteora swap instruction: ~60,000 CU
   * - Compute Budget + ATA setup: ~15,000 CU
   */
  public profileRoute(route: RoutePlan, priorityLevel: 'low' | 'medium' | 'high' = 'medium'): SimulationProfile {
    let totalEstimatedUnits = 35_000; // base overhead
    const hopBreakdown: SimulationProfile['hopBreakdown'] = [];

    route.hops.forEach((hop, idx) => {
      let dexUnits = 60_000;
      if (hop.dex === 'Raydium') dexUnits = 55_000;
      else if (hop.dex === 'Orca') dexUnits = 68_000;
      else if (hop.dex === 'Meteora') dexUnits = 62_000;

      totalEstimatedUnits += dexUnits;
      hopBreakdown.push({
        hopIndex: idx + 1,
        dex: hop.dex,
        estimatedUnits: dexUnits,
      });
    });

    // Add 15% safety buffer
    const computeUnitLimit = Math.min(1_400_000, Math.ceil(totalEstimatedUnits * 1.15));

    // Priority fee recommendation in micro-lamports per CU
    const priorityFees = {
      low: 10_000,
      medium: 50_000,
      high: 150_000,
    };
    const recommendedPriorityFeeMicroLamports = priorityFees[priorityLevel];

    // Priority fee in lamports: (CU * micro-lamports) / 1,000,000 + 5,000 base fee
    const priorityFeeLamports = Math.ceil(
      (computeUnitLimit * recommendedPriorityFeeMicroLamports) / 1_000_000
    );
    const estimatedFeeLamports = 5000 + priorityFeeLamports;

    const logs = [
      `Program ComputeBudget111111111111111111111111111111 invoke [1]`,
      `Program ComputeBudget111111111111111111111111111111 success`,
      ...route.hops.map(
        (h, i) =>
          `Program ${h.dex}Router invoke [1] - Hop ${i + 1}: consumed ${hopBreakdown[i].estimatedUnits} of ${computeUnitLimit} compute units`
      ),
      `Program return: success (total units consumed: ${totalEstimatedUnits})`,
    ];

    return {
      success: true,
      unitsConsumed: totalEstimatedUnits,
      computeUnitLimit,
      recommendedPriorityFeeMicroLamports,
      estimatedFeeLamports,
      logs,
      hopBreakdown,
    };
  }

  /**
   * Simulates a live transaction against the Solana RPC endpoint.
   * If offline or RPC error occurs, falls back gracefully.
   */
  public async simulateLiveTransaction(
    transaction: Transaction | VersionedTransaction
  ): Promise<SimulationProfile> {
    if (!this.connection) {
      throw new Error('Solana RPC connection not configured for live simulation');
    }

    try {
      let res: SimulatedTransactionResponse;
      if ('version' in transaction) {
        const sim = await this.connection.simulateTransaction(transaction, {
          sigVerify: false,
        });
        res = sim.value;
      } else {
        const sim = await this.connection.simulateTransaction(transaction);
        res = sim.value;
      }

      const unitsConsumed = res.unitsConsumed ?? 80_000;
      const logs = res.logs ?? [];
      const isSuccess = res.err === null;

      return {
        success: isSuccess,
        unitsConsumed,
        computeUnitLimit: Math.ceil(unitsConsumed * 1.2),
        recommendedPriorityFeeMicroLamports: 50_000,
        estimatedFeeLamports: 5000 + Math.ceil((unitsConsumed * 50_000) / 1_000_000),
        logs,
        error: res.err ? JSON.stringify(res.err) : undefined,
        hopBreakdown: [
          {
            hopIndex: 1,
            dex: 'Aggregator',
            estimatedUnits: unitsConsumed,
          },
        ],
      };
    } catch (err: any) {
      return {
        success: false,
        unitsConsumed: 0,
        computeUnitLimit: 200_000,
        recommendedPriorityFeeMicroLamports: 50_000,
        estimatedFeeLamports: 5000,
        logs: [`Simulation failed: ${err?.message || err}`],
        error: err?.message || String(err),
        hopBreakdown: [],
      };
    }
  }
}
