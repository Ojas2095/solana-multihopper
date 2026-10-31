export interface JupiterSwapInfo {
  ammKey: string;
  label: string;
  inputMint: string;
  outputMint: string;
  inAmount: string;
  outAmount: string;
  feeAmount: string;
  feeMint: string;
}

export interface JupiterRoutePlanStep {
  swapInfo: JupiterSwapInfo;
  percent: number;
}

export interface JupiterQuoteResponse {
  inputMint: string;
  inAmount: string;
  outputMint: string;
  outAmount: string;
  otherAmountThreshold: string;
  swapMode: 'ExactIn' | 'ExactOut';
  slippageBps: number;
  priceImpactPct: string;
  routePlan: JupiterRoutePlanStep[];
  contextSlot?: number;
  timeTaken?: number;
}

export interface JupiterSwapRequest {
  userPublicKey: string;
  quoteResponse: JupiterQuoteResponse;
  wrapAndUnwrapSol?: boolean;
  useSharedAccounts?: boolean;
  prioritizationFeeLamports?: number | 'auto';
  dynamicComputeUnitLimit?: boolean;
}

export interface JupiterSwapResponse {
  swapTransaction: string; // Base64 encoded serialized VersionedTransaction
  lastValidBlockHeight: number;
  prioritizationFeeLamports?: number;
  computeUnitLimit?: number;
}

export interface QuoteComparison {
  inputMint: string;
  outputMint: string;
  amountIn: string;
  customOutAmount: string;
  jupiterOutAmount: string;
  outDifferencePct: number;
  isCustomBetter: boolean;
  customHops: number;
  jupiterHops: number;
  customPriceImpactPct: number;
  jupiterPriceImpactPct: number;
  recommendedEngine: 'MultiHopper' | 'Jupiter';
}
