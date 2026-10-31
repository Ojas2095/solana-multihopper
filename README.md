# MultiHopper: Solana Multi-Hop DEX Routing Engine & Jupiter v6 Comparator

MultiHopper is an algorithmic multi-hop route finding and preflight simulation suite built on Solana for the Superteam Earn MultiHopper Challenge.

## Features
- **Directed Graph Routing**: Dijkstra and Depth-First Search multi-path traversal across AMM liquidity pools (Raydium, Orca, Meteora).
- **Constant Product AMM Invariants**: Analytical formulas for $x \cdot y = k$, fee deductions (basis points), price impact, and slippage bounds.
- **Jupiter v6 Aggregator Comparator**: Direct quote comparison against Jupiter v6 aggregated routing with execution recommendations.
- **Compute Unit Profiler**: Preflight transaction simulation evaluating ComputeBudget limits and priority fees.
- **Commander CLI**: Interactive routing from the terminal.
- **Next.js 14 App Router UI**: Real-time visual route hop topology and swap card interface.

## Quick Start
```bash
# Install dependencies
npm install

# Run automated test suite
npm test

# Build TypeScript
npm run build

# Interactive CLI Route Finder
npm run cli -- route --input SOL --output BONK --amount 1.5 --max-hops 3 --simulate --compare
```
