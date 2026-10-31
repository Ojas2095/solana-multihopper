#!/usr/bin/env node
import { Command } from 'commander';
import chalk from 'chalk';
import { MultiHopRouter } from '../core/graph.js';
import {
  TOKENS,
  getTokenBySymbol,
  getTokenByMint,
  parseTokenAmount,
  formatTokenAmount,
} from '../core/tokens.js';
import { calculateMinimumAmountOut } from '../core/math.js';
import { TransactionSimulator } from '../core/simulator.js';
import { JupiterClient } from '../jupiter/client.js';

const program = new Command();

program
  .name('multihopper')
  .description('Solana Multi-Hop DEX Routing Engine & Jupiter v6 Aggregator Comparator')
  .version('1.0.0');

program
  .command('tokens')
  .description('List all supported tokens and mint addresses')
  .action(() => {
    console.log(chalk.bold.cyan('\nSupported Solana Mint Registry:'));
    console.log('--------------------------------------------------------------------------------');
    Object.values(TOKENS).forEach((t) => {
      console.log(
        `${chalk.green(t.symbol.padEnd(6))} | ${chalk.yellow(t.name.padEnd(16))} | Decimals: ${t.decimals} | Mint: ${t.mint}`
      );
    });
    console.log('--------------------------------------------------------------------------------\n');
  });

program
  .command('pools')
  .description('List available liquidity pools and DEX reserves')
  .action(() => {
    const router = new MultiHopRouter();
    console.log(chalk.bold.cyan('\nRegistered DEX Liquidity Pools:'));
    console.log('--------------------------------------------------------------------------------');
    router.getPools().forEach((p) => {
      const tA = getTokenByMint(p.tokenA)?.symbol || p.tokenA.slice(0, 6);
      const tB = getTokenByMint(p.tokenB)?.symbol || p.tokenB.slice(0, 6);
      console.log(
        `[${chalk.magenta(p.dex)}] ${chalk.green(tA)} <-> ${chalk.green(tB)} | Fee: ${(p.feeBps / 100).toFixed(2)}% | ID: ${p.id}`
      );
    });
    console.log('--------------------------------------------------------------------------------\n');
  });

program
  .command('route')
  .description('Find the optimal multi-hop swap route across Solana DEXes')
  .requiredOption('-i, --input <symbol_or_mint>', 'Input token symbol (e.g. SOL) or mint address')
  .requiredOption('-o, --output <symbol_or_mint>', 'Output token symbol (e.g. BONK) or mint address')
  .requiredOption('-a, --amount <amount>', 'Amount to trade (in standard human units, e.g. 1.5)')
  .option('-m, --max-hops <number>', 'Maximum number of hops allowed', '3')
  .option('-s, --slippage <bps>', 'Slippage tolerance in basis points', '50')
  .option('--simulate', 'Simulate transaction and profile Compute Units', false)
  .option('--compare', 'Compare with Jupiter v6 aggregator quote', false)
  .action(async (opts) => {
    try {
      const inToken = getTokenBySymbol(opts.input) || getTokenByMint(opts.input);
      const outToken = getTokenBySymbol(opts.output) || getTokenByMint(opts.output);

      if (!inToken) {
        console.error(chalk.red(`Error: Unknown input token '${opts.input}'`));
        process.exit(1);
      }
      if (!outToken) {
        console.error(chalk.red(`Error: Unknown output token '${opts.output}'`));
        process.exit(1);
      }

      const amountRaw = parseTokenAmount(opts.amount, inToken.decimals);
      const maxHops = parseInt(opts.maxHops, 10);
      const slippageBps = parseInt(opts.slippage, 10);

      console.log(chalk.bold.blue('\n============================================================='));
      console.log(chalk.bold.blue('        SOLANA MULTI-HOPPER ROUTE OPTIMIZATION ENGINE        '));
      console.log(chalk.bold.blue('============================================================='));
      console.log(`Input Token  : ${chalk.green(inToken.symbol)} (${inToken.mint})`);
      console.log(`Output Token : ${chalk.green(outToken.symbol)} (${outToken.mint})`);
      console.log(`Trade Amount : ${chalk.yellow(opts.amount)} ${inToken.symbol} (${amountRaw.toString()} base units)`);
      console.log(`Slippage     : ${(slippageBps / 100).toFixed(2)}% (${slippageBps} bps)`);
      console.log(`Max Hops     : ${maxHops}`);
      console.log('-------------------------------------------------------------');

      const router = new MultiHopRouter();
      const route = router.findBestRoute(inToken.mint, outToken.mint, amountRaw, maxHops);

      if (!route) {
        console.log(chalk.red('\nNo viable routing path found with sufficient liquidity.'));
        return;
      }

      const formattedOut = formatTokenAmount(route.amountOut, outToken.decimals);
      const minOutRaw = calculateMinimumAmountOut(route.amountOut, slippageBps);
      const formattedMinOut = formatTokenAmount(minOutRaw, outToken.decimals);

      console.log(chalk.bold.green('\nOPTIMAL ROUTE PLAN DISCOVERED:'));
      console.log(`Hop Count        : ${route.hops.length}`);
      console.log(`Expected Output  : ${chalk.bold.yellow(formattedOut)} ${outToken.symbol}`);
      console.log(`Minimum Output   : ${formattedMinOut} ${outToken.symbol} (guaranteed at ${(slippageBps / 100).toFixed(2)}% slippage)`);
      console.log(`Price Impact     : ${chalk.cyan(route.cumulativePriceImpactPct.toFixed(3) + '%')}`);
      console.log(`Total Fee        : ${(route.totalFeeBps / 100).toFixed(2)}%`);
      console.log(`Solver Latency   : ${route.executionTimeMs} ms\n`);

      console.log(chalk.bold.underline('Execution Path:'));
      route.hops.forEach((h, idx) => {
        const from = getTokenByMint(h.inputMint)?.symbol || h.inputMint.slice(0, 4);
        const to = getTokenByMint(h.outputMint)?.symbol || h.outputMint.slice(0, 4);
        const fromDec = getTokenByMint(h.inputMint)?.decimals || 6;
        const toDec = getTokenByMint(h.outputMint)?.decimals || 6;
        console.log(
          `  Hop #${idx + 1}: [${chalk.magenta(h.dex)}] ` +
          `${formatTokenAmount(h.amountIn, fromDec)} ${chalk.green(from)} -> ` +
          `${formatTokenAmount(h.amountOut, toDec)} ${chalk.green(to)} ` +
          `(Impact: ${h.priceImpactPct.toFixed(3)}%, Fee: ${(h.feeBps / 100).toFixed(2)}%)`
        );
      });

      if (opts.simulate) {
        console.log(chalk.bold.cyan('\n-------------------------------------------------------------'));
        console.log(chalk.bold.cyan('TRANSACTION SIMULATION & COMPUTE UNIT PROFILE:'));
        const sim = new TransactionSimulator();
        const profile = sim.profileRoute(route);
        console.log(`Simulation Status  : ${profile.success ? chalk.green('PASSED (SUCCESS)') : chalk.red('FAILED')}`);
        console.log(`Compute Units Est  : ${chalk.yellow(profile.unitsConsumed.toLocaleString())} CU`);
        console.log(`Compute Budget Cap : ${chalk.yellow(profile.computeUnitLimit.toLocaleString())} CU`);
        console.log(`Priority Fee Rec   : ${profile.recommendedPriorityFeeMicroLamports} micro-lamports/CU`);
        console.log(`Estimated Total Fee: ${(profile.estimatedFeeLamports / 1e9).toFixed(6)} SOL`);
      }

      if (opts.compare) {
        console.log(chalk.bold.cyan('\n-------------------------------------------------------------'));
        console.log(chalk.bold.cyan('JUPITER v6 AGGREGATOR COMPARISON:'));
        const jup = new JupiterClient();
        const jupQuote = await jup.getQuote(inToken.mint, outToken.mint, amountRaw.toString(), slippageBps);
        const comparison = jup.compareQuotes(route, jupQuote);
        const jupFormattedOut = formatTokenAmount(comparison.jupiterOutAmount, outToken.decimals);

        console.log(`MultiHopper Output : ${chalk.yellow(formattedOut)} ${outToken.symbol}`);
        console.log(`Jupiter v6 Output  : ${chalk.yellow(jupFormattedOut)} ${outToken.symbol}`);
        console.log(`Variance           : ${comparison.outDifferencePct >= 0 ? chalk.green('+' + comparison.outDifferencePct.toFixed(3) + '%') : chalk.red(comparison.outDifferencePct.toFixed(3) + '%')}`);
        console.log(`Recommended Engine : ${chalk.bold.magenta(comparison.recommendedEngine)}`);
      }

      console.log(chalk.bold.blue('\n=============================================================\n'));
    } catch (err: any) {
      console.error(chalk.red(`Error executing route: ${err?.message || err}`));
      process.exit(1);
    }
  });

program.parse(process.argv);
