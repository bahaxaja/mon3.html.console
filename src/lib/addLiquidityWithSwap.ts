import { 
  fetchWhirlpool, 
  getOpenBundledPositionInstruction,
  getBundledPositionAddress,
  getPositionBundleAddress,
  getIncreaseLiquidityV2Instruction,
  getTickArrayAddress,
  fetchPosition
} from "@orca-so/whirlpools-client";
import { 
  sqrtPriceToPrice, 
  priceToTickIndex,
  increaseLiquidityQuoteA,
  increaseLiquidityQuoteB,
  getTickArrayStartTickIndex,
  isPositionInRange
} from "@orca-so/whirlpools-core";
import { swapInstructions } from "@orca-so/whirlpools";
import { 
  address, 
  Rpc, 
  Address, 
  createTransactionMessage, 
  setTransactionMessageFeePayer,
  setTransactionMessageLifetimeUsingBlockhash,
  appendTransactionMessageInstructions,
  compileTransaction,
  getSignatureFromTransaction,
  TransactionSigner,
  getProgramDerivedAddress
} from "@solana/kit";
import { getSetComputeUnitLimitInstruction } from "@solana-program/compute-budget";

const TOKEN_PROGRAM_ID = address("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
const ASSOCIATED_TOKEN_PROGRAM_ID = address("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL");
const MEMO_PROGRAM_ID = address("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr");

async function getAssociatedTokenAddress(mint: Address, owner: Address): Promise<Address> {
  const [ata] = await getProgramDerivedAddress({
    programAddress: ASSOCIATED_TOKEN_PROGRAM_ID,
    seeds: [
      new TextEncoder().encode(owner.toString()).slice(0, 32),
      new TextEncoder().encode(TOKEN_PROGRAM_ID.toString()).slice(0, 32),
      new TextEncoder().encode(mint.toString()).slice(0, 32),
    ]
  });
  return ata;
}

export interface TransactionBatch {
  instructions: any[];
  positionIndices: number[];
  description: string;
}

export interface SwapAndLiquidityResult {
  swapBatch: TransactionBatch | null;
  positionBatches: TransactionBatch[];
  totalBatches: number;
  totalPositions: number;
  swapAmount: bigint;
  tokenAPerPosition: bigint;
  tokenBPerPosition: bigint;
  positionBundleAddress: Address;
  poolAddress: Address;
  currentPrice: number;
}

export async function createPositionsWithLiquidity(
  bundleMintAddress: string, 
  poolAddress: string, 
  rpc: Rpc<any>,
  wallet: {
    publicKey: Address;
    signAllTransactions?: (txs: any[]) => Promise<any[]>;
  } & TransactionSigner,
  totalSolAmount: bigint,
  totalPositions: number = 20, 
  rangePercent: number = 0.001,
  startIndex: number = 0,
  bundleTokenAccountAddress?: string,
  slippageToleranceBps: number = 100
): Promise<SwapAndLiquidityResult> {
  const CHUNK_SIZE = 2;
  const CU_LIMIT = 1_000_000;
  
  const poolAddr = address(poolAddress);
  const bundleMint = address(bundleMintAddress);
  
  const [positionBundleAddress] = await getPositionBundleAddress(bundleMint);
  
  const positionBundleTokenAccount = bundleTokenAccountAddress 
    ? address(bundleTokenAccountAddress) 
    : await getAssociatedTokenAddress(bundleMint, wallet.publicKey);
  
  const whirlpool = await fetchWhirlpool(rpc, poolAddr);
  
  if (!whirlpool || !whirlpool.data) {
    throw new Error("Failed to fetch whirlpool data");
  }
  
  const tickSpacing = whirlpool.data.tickSpacing;
  const decimalsA = 9;
  const decimalsB = 6;
  const currentSqrtPrice = whirlpool.data.sqrtPrice;
  const currentPrice = sqrtPriceToPrice(currentSqrtPrice, decimalsA, decimalsB);

  const tokenMintA = whirlpool.data.tokenMintA;
  const tokenMintB = whirlpool.data.tokenMintB;
  const tokenVaultA = whirlpool.data.tokenVaultA;
  const tokenVaultB = whirlpool.data.tokenVaultB;

  const halfSol = totalSolAmount / 2n;
  
  console.log(`\n═══════════════════════════════════════════════════════════`);
  console.log(`LIQUIDITY ALLOCATION PLAN`);
  console.log(`═══════════════════════════════════════════════════════════`);
  console.log(`Total SOL Input: ${Number(totalSolAmount) / 1e9} SOL`);
  console.log(`Half for Token A (keep): ${Number(halfSol) / 1e9} SOL`);
  console.log(`Half for Token B (swap): ${Number(halfSol) / 1e9} SOL`);
  console.log(`Total Positions to Create: ${totalPositions}`);
  console.log(`SOL per Position (Token A): ${Number(halfSol / BigInt(totalPositions)) / 1e9} SOL`);
  console.log(`═══════════════════════════════════════════════════════════\n`);
  
  let swapBatch: TransactionBatch | null = null;
  
  const SOL_MINT = address("So11111111111111111111111111111111111111112");
  const isTokenASol = tokenMintA.toString() === SOL_MINT.toString();
  
  if (isTokenASol) {
    try {
      const { instructions: swapIxs, quote } = await swapInstructions(
        rpc,
        { inputAmount: halfSol, mint: SOL_MINT },
        poolAddr,
        slippageToleranceBps,
        wallet
      );
      
      swapBatch = {
        instructions: [
          getSetComputeUnitLimitInstruction({ units: 400_000 }),
          ...swapIxs
        ],
        positionIndices: [],
        description: `Swap ${Number(halfSol) / 1e9} SOL -> Token B`
      };
      
      console.log(`\n✓ Swap Instruction Created:`);
      console.log(`  Swap Amount: ${Number(halfSol) / 1e9} SOL`);
      console.log(`  Expected Token B Out: ${Number(quote.tokenEstOut) / Math.pow(10, decimalsB)} Token B`);
      console.log(`  Exchange Rate: 1 SOL ≈ ${(Number(quote.tokenEstOut) / Math.pow(10, decimalsB)) / (Number(halfSol) / 1e9)} Token B`);
    } catch (err: any) {
      console.error("Failed to generate swap instructions:", err.message);
    }
  }

  const tokenAPerPosition = halfSol / BigInt(totalPositions);
  const estimatedTokenBPerPosition = BigInt(Math.floor(Number(tokenAPerPosition) * Number(currentPrice)));

  const tokenOwnerAccountA = await getAssociatedTokenAddress(tokenMintA, wallet.publicKey);
  const tokenOwnerAccountB = await getAssociatedTokenAddress(tokenMintB, wallet.publicKey);

  const allBatches: TransactionBatch[] = [];

  for (let i = 0; i < totalPositions; i += CHUNK_SIZE) {
    const currentBatchEnd = Math.min(i + CHUNK_SIZE, totalPositions);
    const batchInstructions: any[] = [];
    const positionIndices: number[] = [];

    batchInstructions.push(getSetComputeUnitLimitInstruction({ units: CU_LIMIT }));

    for (let j = i; j < currentBatchEnd; j++) {
      const positionIndex = startIndex + j;
      const offsetMultiplier = (j - totalPositions / 2) * rangePercent;
      const targetLowerPrice = Number(currentPrice) * (1 + offsetMultiplier);
      const targetUpperPrice = Number(currentPrice) * (1 + offsetMultiplier + rangePercent);

      const tickLowerRaw = priceToTickIndex(targetLowerPrice, decimalsA, decimalsB);
      const tickUpperRaw = priceToTickIndex(targetUpperPrice, decimalsA, decimalsB);
      
      const tickLower = Math.floor(tickLowerRaw / tickSpacing) * tickSpacing;
      const tickUpper = Math.floor(tickUpperRaw / tickSpacing) * tickSpacing;

      // Check if position is in range using isPositionInRange
      const inRange = isPositionInRange(currentSqrtPrice, tickLower, tickUpper);

      if (!inRange) {
        console.log(`Position ${positionIndex} (${tickLower} to ${tickUpper}) is out of range. Current price: ${currentPrice}. Skipping liquidity for this position.`);
        continue;
      }

      try {
        const [bundledPositionAddress] = await getBundledPositionAddress(
          positionBundleAddress, 
          positionIndex
        );

        const openInstruction = getOpenBundledPositionInstruction({
          bundledPosition: bundledPositionAddress,
          positionBundle: positionBundleAddress,
          positionBundleTokenAccount: positionBundleTokenAccount,
          positionBundleAuthority: wallet.publicKey,
          whirlpool: poolAddr,
          funder: wallet.publicKey,
          bundleIndex: positionIndex,
          tickLowerIndex: tickLower,
          tickUpperIndex: tickUpper,
        });

        batchInstructions.push(openInstruction);

        const quote = increaseLiquidityQuoteA(
          tokenAPerPosition,
          slippageToleranceBps,
          currentSqrtPrice,
          tickLower,
          tickUpper,
          { feeBps: 0, maxFee: 0n }
        );

        const tickArrayLowerStartIndex = getTickArrayStartTickIndex(tickLower, tickSpacing);
        const tickArrayUpperStartIndex = getTickArrayStartTickIndex(tickUpper, tickSpacing);
        
        const [tickArrayLower] = await getTickArrayAddress(poolAddr, tickArrayLowerStartIndex);
        const [tickArrayUpper] = await getTickArrayAddress(poolAddr, tickArrayUpperStartIndex);

        const increaseLiquidityIx = getIncreaseLiquidityV2Instruction({
          whirlpool: poolAddr,
          tokenProgramA: TOKEN_PROGRAM_ID,
          tokenProgramB: TOKEN_PROGRAM_ID,
          memoProgram: MEMO_PROGRAM_ID,
          positionAuthority: wallet,
          position: bundledPositionAddress,
          positionTokenAccount: positionBundleTokenAccount,
          tokenMintA: tokenMintA,
          tokenMintB: tokenMintB,
          tokenOwnerAccountA: tokenOwnerAccountA,
          tokenOwnerAccountB: tokenOwnerAccountB,
          tokenVaultA: tokenVaultA,
          tokenVaultB: tokenVaultB,
          tickArrayLower: tickArrayLower,
          tickArrayUpper: tickArrayUpper,
          liquidityAmount: quote.liquidityDelta,
          tokenMaxA: quote.tokenMaxA,
          tokenMaxB: quote.tokenMaxB,
          remainingAccountsInfo: null,
        });

        batchInstructions.push(increaseLiquidityIx);
        positionIndices.push(positionIndex);
      } catch (err: any) {
        console.error(`Failed to create instruction for position ${positionIndex}:`, err.message);
      }
    }

    if (batchInstructions.length > 1) {
      allBatches.push({ 
        instructions: batchInstructions, 
        positionIndices,
        description: `Open + Add liquidity: positions ${positionIndices.join(', ')}`
      });
    }
  }

  console.log(`\n═══════════════════════════════════════════════════════════`);
  console.log(`POSITION FUNDING SUMMARY`);
  console.log(`═══════════════════════════════════════════════════════════`);
  const totalInRangePositions = allBatches.reduce((sum, batch) => sum + batch.positionIndices.length, 0);
  console.log(`Requested Positions: ${totalPositions}`);
  console.log(`In-Range Positions Funded: ${totalInRangePositions}`);
  console.log(`Out-of-Range Positions Skipped: ${totalPositions - totalInRangePositions}`);
  console.log(`Transaction Batches Created: ${allBatches.length}`);
  
  if (allBatches.length > 0) {
    console.log(`\nFunded Position Indices:`);
    const fundedIndices = allBatches.flatMap(batch => batch.positionIndices);
    console.log(`  ${fundedIndices.join(', ')}`);
  }
  console.log(`═══════════════════════════════════════════════════════════\n`);
  
  return {
    swapBatch,
    positionBatches: allBatches,
    totalBatches: allBatches.length + (swapBatch ? 1 : 0),
    totalPositions,
    swapAmount: halfSol,
    tokenAPerPosition,
    tokenBPerPosition: estimatedTokenBPerPosition,
    positionBundleAddress,
    poolAddress: poolAddr,
    currentPrice: Number(currentPrice)
  };
}

export async function addLiquidityToExistingPositions(
  bundleMintAddress: string, 
  poolAddress: string, 
  rpc: Rpc<any>,
  wallet: {
    publicKey: Address;
    signAllTransactions?: (txs: any[]) => Promise<any[]>;
  } & TransactionSigner,
  totalSolAmount: bigint,
  positionIndices: number[],
  bundleTokenAccountAddress?: string,
  slippageToleranceBps: number = 100
): Promise<SwapAndLiquidityResult> {
  const CHUNK_SIZE = 3;
  const CU_LIMIT = 800_000;
  
  const poolAddr = address(poolAddress);
  const bundleMint = address(bundleMintAddress);
  
  const [positionBundleAddress] = await getPositionBundleAddress(bundleMint);
  
  const positionBundleTokenAccount = bundleTokenAccountAddress 
    ? address(bundleTokenAccountAddress) 
    : await getAssociatedTokenAddress(bundleMint, wallet.publicKey);
  
  const whirlpool = await fetchWhirlpool(rpc, poolAddr);
  
  if (!whirlpool || !whirlpool.data) {
    throw new Error("Failed to fetch whirlpool data");
  }
  
  const tickSpacing = whirlpool.data.tickSpacing;
  const decimalsA = 9;
  const decimalsB = 6;
  const currentSqrtPrice = whirlpool.data.sqrtPrice;
  const currentPrice = sqrtPriceToPrice(currentSqrtPrice, decimalsA, decimalsB);

  const tokenMintA = whirlpool.data.tokenMintA;
  const tokenMintB = whirlpool.data.tokenMintB;
  const tokenVaultA = whirlpool.data.tokenVaultA;
  const tokenVaultB = whirlpool.data.tokenVaultB;

  const halfSol = totalSolAmount / 2n;
  const totalPositions = positionIndices.length;
  
  console.log(`\n═══════════════════════════════════════════════════════════`);
  console.log(`ADD LIQUIDITY TO EXISTING POSITIONS`);
  console.log(`═══════════════════════════════════════════════════════════`);
  console.log(`Total SOL Input: ${Number(totalSolAmount) / 1e9} SOL`);
  console.log(`Half for Token A (keep): ${Number(halfSol) / 1e9} SOL`);
  console.log(`Half for Token B (swap): ${Number(halfSol) / 1e9} SOL`);
  console.log(`Total Positions to Update: ${totalPositions}`);
  console.log(`SOL per Position (Token A): ${Number(halfSol / BigInt(totalPositions)) / 1e9} SOL`);
  console.log(`Position Indices: ${positionIndices.join(', ')}`);
  console.log(`═══════════════════════════════════════════════════════════\n`);
  
  let swapBatch: TransactionBatch | null = null;
  
  const SOL_MINT = address("So11111111111111111111111111111111111111112");
  const isTokenASol = tokenMintA.toString() === SOL_MINT.toString();
  
  if (isTokenASol) {
    try {
      const { instructions: swapIxs, quote } = await swapInstructions(
        rpc,
        { inputAmount: halfSol, mint: SOL_MINT },
        poolAddr,
        slippageToleranceBps,
        wallet
      );
      
      swapBatch = {
        instructions: [
          getSetComputeUnitLimitInstruction({ units: 400_000 }),
          ...swapIxs
        ],
        positionIndices: [],
        description: `Swap ${Number(halfSol) / 1e9} SOL -> Token B`
      };
      
      console.log(`\n✓ Swap Instruction Created:`);
      console.log(`  Swap Amount: ${Number(halfSol) / 1e9} SOL`);
      console.log(`  Expected Token B Out: ${Number(quote.tokenEstOut) / Math.pow(10, decimalsB)} Token B`);
      console.log(`  Exchange Rate: 1 SOL ≈ ${(Number(quote.tokenEstOut) / Math.pow(10, decimalsB)) / (Number(halfSol) / 1e9)} Token B`);
    } catch (err: any) {
      console.error("Failed to generate swap instructions:", err.message);
    }
  }

  const tokenAPerPosition = halfSol / BigInt(totalPositions);
  const estimatedTokenBPerPosition = BigInt(Math.floor(Number(tokenAPerPosition) * Number(currentPrice)));

  const tokenOwnerAccountA = await getAssociatedTokenAddress(tokenMintA, wallet.publicKey);
  const tokenOwnerAccountB = await getAssociatedTokenAddress(tokenMintB, wallet.publicKey);

  const allBatches: TransactionBatch[] = [];

  for (let i = 0; i < totalPositions; i += CHUNK_SIZE) {
    const currentBatchEnd = Math.min(i + CHUNK_SIZE, totalPositions);
    const batchInstructions: any[] = [];
    const batchPositionIndices: number[] = [];

    batchInstructions.push(getSetComputeUnitLimitInstruction({ units: CU_LIMIT }));

    for (let j = i; j < currentBatchEnd; j++) {
      const positionIndex = positionIndices[j];

      try {
        const [bundledPositionAddress] = await getBundledPositionAddress(
          positionBundleAddress, 
          positionIndex
        );

        const position = await fetchPosition(rpc, bundledPositionAddress);
        if (!position?.data) {
          console.error(`Position ${positionIndex} not found`);
          continue;
        }

        const tickLower = position.data.tickLowerIndex;
        const tickUpper = position.data.tickUpperIndex;

        // Check if position is in range using isPositionInRange
        const inRange = isPositionInRange(currentSqrtPrice, tickLower, tickUpper);

        if (!inRange) {
          console.log(`Position ${positionIndex} (${tickLower} to ${tickUpper}) is out of range. Current sqrt price: ${currentSqrtPrice.toString()}. Skipping liquidity for this position.`);
          continue;
        }

        const quote = increaseLiquidityQuoteA(
          tokenAPerPosition,
          slippageToleranceBps,
          currentSqrtPrice,
          tickLower,
          tickUpper,
          { feeBps: 0, maxFee: 0n }
        );

        const tickArrayLowerStartIndex = getTickArrayStartTickIndex(tickLower, tickSpacing);
        const tickArrayUpperStartIndex = getTickArrayStartTickIndex(tickUpper, tickSpacing);
        
        const [tickArrayLower] = await getTickArrayAddress(poolAddr, tickArrayLowerStartIndex);
        const [tickArrayUpper] = await getTickArrayAddress(poolAddr, tickArrayUpperStartIndex);

        const increaseLiquidityIx = getIncreaseLiquidityV2Instruction({
          whirlpool: poolAddr,
          tokenProgramA: TOKEN_PROGRAM_ID,
          tokenProgramB: TOKEN_PROGRAM_ID,
          memoProgram: MEMO_PROGRAM_ID,
          positionAuthority: wallet,
          position: bundledPositionAddress,
          positionTokenAccount: positionBundleTokenAccount,
          tokenMintA: tokenMintA,
          tokenMintB: tokenMintB,
          tokenOwnerAccountA: tokenOwnerAccountA,
          tokenOwnerAccountB: tokenOwnerAccountB,
          tokenVaultA: tokenVaultA,
          tokenVaultB: tokenVaultB,
          tickArrayLower: tickArrayLower,
          tickArrayUpper: tickArrayUpper,
          liquidityAmount: quote.liquidityDelta,
          tokenMaxA: quote.tokenMaxA,
          tokenMaxB: quote.tokenMaxB,
          remainingAccountsInfo: null,
        });

        batchInstructions.push(increaseLiquidityIx);
        batchPositionIndices.push(positionIndex);
      } catch (err: any) {
        console.error(`Failed to create instruction for position ${positionIndex}:`, err.message);
      }
    }

    if (batchInstructions.length > 1) {
      allBatches.push({ 
        instructions: batchInstructions, 
        positionIndices: batchPositionIndices,
        description: `Add liquidity: positions ${batchPositionIndices.join(', ')}`
      });
    }
  }

  console.log(`\n═══════════════════════════════════════════════════════════`);
  console.log(`POSITION FUNDING SUMMARY (EXISTING POSITIONS)`);
  console.log(`═══════════════════════════════════════════════════════════`);
  const totalInRangePositions = allBatches.reduce((sum, batch) => sum + batch.positionIndices.length, 0);
  console.log(`Total Positions to Fund: ${totalPositions}`);
  console.log(`In-Range Positions Funded: ${totalInRangePositions}`);
  console.log(`Out-of-Range Positions Skipped: ${totalPositions - totalInRangePositions}`);
  console.log(`Transaction Batches Created: ${allBatches.length}`);
  
  if (allBatches.length > 0) {
    console.log(`\nFunded Position Indices:`);
    const fundedIndices = allBatches.flatMap(batch => batch.positionIndices);
    console.log(`  ${fundedIndices.join(', ')}`);
  }
  console.log(`═══════════════════════════════════════════════════════════\n`);
  
  return {
    swapBatch,
    positionBatches: allBatches,
    totalBatches: allBatches.length + (swapBatch ? 1 : 0),
    totalPositions,
    swapAmount: halfSol,
    tokenAPerPosition,
    tokenBPerPosition: estimatedTokenBPerPosition,
    positionBundleAddress,
    poolAddress: poolAddr,
    currentPrice: Number(currentPrice)
  };
}

export async function buildAllTransactionsForSigning(
  rpc: Rpc<any>,
  result: SwapAndLiquidityResult,
  walletPublicKey: Address
): Promise<any[]> {
  const { value: latestBlockhash } = await rpc.getLatestBlockhash().send();
  
  const allBatches: TransactionBatch[] = [];
  
  if (result.swapBatch) {
    allBatches.push(result.swapBatch);
  }
  
  allBatches.push(...result.positionBatches);
  
  const transactions = allBatches.map(batch => {
    let message = createTransactionMessage({ version: 0 });
    message = setTransactionMessageFeePayer(walletPublicKey, message);
    message = setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, message);
    message = appendTransactionMessageInstructions(batch.instructions, message);
    return compileTransaction(message);
  });
  
  return transactions;
}

export async function signAndSendAllTransactions(
  rpc: Rpc<any>,
  result: SwapAndLiquidityResult,
  wallet: {
    publicKey: Address;
    signAllTransactions: (txs: any[]) => Promise<any[]>;
  },
  onProgress?: (completed: number, total: number, signature: string, description: string) => void
): Promise<string[]> {
  if (!wallet.signAllTransactions) {
    throw new Error("Wallet does not support signAllTransactions");
  }
  
  const allBatches: TransactionBatch[] = [];
  
  if (result.swapBatch) {
    allBatches.push(result.swapBatch);
  }
  
  allBatches.push(...result.positionBatches);
  
  console.log(`Requesting approval for ${allBatches.length} transactions...`);
  
  const transactionsToSign = await buildAllTransactionsForSigning(
    rpc, 
    result, 
    wallet.publicKey
  );

  const signedTxs = await wallet.signAllTransactions(transactionsToSign);
  
  const results: string[] = [];
  
  for (let i = 0; i < signedTxs.length; i++) {
    const signedTx = signedTxs[i];
    const batch = allBatches[i];
    try {
      const signature = getSignatureFromTransaction(signedTx);
      
      await rpc.sendTransaction(signedTx, { skipPreflight: false }).send();
      
      const signatureStr = typeof signature === 'string' ? signature : Buffer.from(signature).toString('base64');
      console.log(`Transaction ${i + 1}/${signedTxs.length} Successful: ${signatureStr} - ${batch.description}`);
      results.push(signatureStr);
      
      if (onProgress) {
        onProgress(i + 1, signedTxs.length, signatureStr, batch.description);
      }
      
      await new Promise(r => setTimeout(r, 1500));
    } catch (err: any) {
      console.error(`Batch ${i + 1} failed: ${err.message}`);
      throw err;
    }
  }
  
  console.log("All transactions completed successfully.");
  return results;
}
