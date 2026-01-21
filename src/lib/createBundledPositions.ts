//AGENT RULE:
//ALWAYS READ THE .nomodify FILE
//BEFORE EDITING AND DO NOT EDIT
//ANY FILES LISTED IN .nomodify

import { 
  fetchWhirlpool, 
  getOpenBundledPositionInstruction,
  getBundledPositionAddress,
  getPositionBundleAddress,
  getIncreaseLiquidityV2Instruction,
  getTickArrayAddress
} from "@orca-so/whirlpools-client";
import { 
    sqrtPriceToPrice, 
    priceToTickIndex,
    increaseLiquidityQuoteA,
    increaseLiquidityQuoteB,
    getTickArrayStartTickIndex

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
  signTransaction,
  getProgramDerivedAddress,
  TransactionSigner
} from "@solana/kit";
import { getSetComputeUnitLimitInstruction } from "@solana-program/compute-budget";

const MEMO_PROGRAM_ID = address("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr");

const TOKEN_PROGRAM_ID = address("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
const ASSOCIATED_TOKEN_PROGRAM_ID = address("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL");

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

const SOL_MINT = address("So11111111111111111111111111111111111111112");

export interface TransactionBatch {
  instructions: any[];
  positionIndices: number[];
}

export async function createLargeDistributedPositionBatch(
  bundleMintAddress: string, 
  poolAddress: string, 
  rpc: Rpc<any>,
  walletPublicKey: Address,
  totalPositions: number = 20, 
  rangePercent: number = 0.001,
  startIndex: number = 0,
  bundleTokenAccountAddress?: string
) {
  const CHUNK_SIZE = 3;
  const CU_LIMIT = 800_000;
  
  const poolAddr = address(poolAddress);
  const bundleMint = address(bundleMintAddress);
  
  const [positionBundleAddress] = await getPositionBundleAddress(bundleMint);
  
  const positionBundleTokenAccount = bundleTokenAccountAddress 
    ? address(bundleTokenAccountAddress) 
    : await getAssociatedTokenAddress(bundleMint, walletPublicKey);
  
  const whirlpool = await fetchWhirlpool(rpc, poolAddr);
  
  if (!whirlpool || !whirlpool.data) {
    throw new Error("Failed to fetch whirlpool data");
  }
  
  const tickSpacing = whirlpool.data.tickSpacing;
  const decimalsA = 9;
  const decimalsB = 6;
  const currentPrice = sqrtPriceToPrice(whirlpool.data.sqrtPrice, decimalsA, decimalsB);

  const allBatches: TransactionBatch[] = [];

  for (let i = 0; i < totalPositions; i += CHUNK_SIZE) {
    const currentBatchEnd = Math.min(i + CHUNK_SIZE, totalPositions);
    const batchInstructions: any[] = [];
    const positionIndices: number[] = [];

    batchInstructions.push(getSetComputeUnitLimitInstruction({ units: CU_LIMIT }));

    for (let j = i; j < currentBatchEnd; j++) {
      const positionIndex = startIndex + j;
      const offsetMultiplier = (j - totalPositions / 2) * rangePercent;
      const targetLowerPrice = currentPrice * (1 + offsetMultiplier);
      const targetUpperPrice = currentPrice * (1 + offsetMultiplier + rangePercent);

      const tickLowerRaw = priceToTickIndex(targetLowerPrice, decimalsA, decimalsB);
      const tickUpperRaw = priceToTickIndex(targetUpperPrice, decimalsA, decimalsB);
      
      const tickLower = Math.floor(tickLowerRaw / tickSpacing) * tickSpacing;
      const tickUpper = Math.floor(tickUpperRaw / tickSpacing) * tickSpacing;

      try {
        const [bundledPositionAddress] = await getBundledPositionAddress(
          positionBundleAddress, 
          positionIndex
        );

        const instruction = getOpenBundledPositionInstruction({
          bundledPosition: bundledPositionAddress,
          positionBundle: positionBundleAddress,
          positionBundleTokenAccount: positionBundleTokenAccount,
          positionBundleAuthority: walletPublicKey,
          whirlpool: poolAddr,
          funder: walletPublicKey,
          bundleIndex: positionIndex,
          tickLowerIndex: tickLower,
          tickUpperIndex: tickUpper,
        });

        batchInstructions.push(instruction);
        positionIndices.push(positionIndex);
      } catch (err: any) {
        console.error(`Failed to create instruction for position ${positionIndex}:`, err.message);
      }
    }

    if (batchInstructions.length > 1) {
      allBatches.push({ instructions: batchInstructions, positionIndices });
    }
  }

  console.log(`Created ${allBatches.length} transaction batches for ${totalPositions} positions`);
  
  return {
    batches: allBatches,
    totalBatches: allBatches.length,
    totalPositions,
    positionBundleAddress,
    poolAddress: poolAddr,
    currentPrice
  };
}

export async function buildTransactionsForSigning(
  rpc: Rpc<any>,
  batches: TransactionBatch[],
  walletPublicKey: Address
): Promise<any[]> {
  const { value: latestBlockhash } = await rpc.getLatestBlockhash().send();
  
  const transactions = batches.map(batch => {
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
  batches: TransactionBatch[],
  wallet: {
    publicKey: Address;
    signAllTransactions: (txs: any[]) => Promise<any[]>;
  },
  onProgress?: (completed: number, total: number, signature: string) => void
): Promise<string[]> {
  if (!wallet.signAllTransactions) {
    throw new Error("Wallet does not support signAllTransactions");
  }
  
  console.log(`Requesting approval for ${batches.length} transactions...`);
  
  const transactionsToSign = await buildTransactionsForSigning(
    rpc, 
    batches, 
    wallet.publicKey
  );

  const signedTxs = await wallet.signAllTransactions(transactionsToSign);
  
  const results: string[] = [];
  
  for (let i = 0; i < signedTxs.length; i++) {
    const signedTx = signedTxs[i];
    try {
      const signature = getSignatureFromTransaction(signedTx);
      
      await rpc.sendTransaction(signedTx, { skipPreflight: false }).send();
      
      const signatureStr = typeof signature === 'string' ? signature : Buffer.from(signature).toString('base64');
      console.log(`Transaction ${i + 1}/${signedTxs.length} Successful: ${signatureStr}`);
      results.push(signatureStr);
      
      if (onProgress) {
        onProgress(i + 1, signedTxs.length, signatureStr);
      }
      
      await new Promise(r => setTimeout(r, 1000));
    } catch (err: any) {
      console.error(`Batch ${i + 1} failed: ${err.message}`);
      throw err;
    }
  }
  
  console.log("All position batches deployed successfully.");
  return results;
}

export interface SwapAndLiquidityBatch {
  instructions: any[];
  positionIndices: number[];
  description: string;
}

export interface CreatePositionsWithLiquidityResult {
  swapBatch: SwapAndLiquidityBatch | null;
  positionBatches: SwapAndLiquidityBatch[];
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
): Promise<CreatePositionsWithLiquidityResult> {
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
    const { tokenMintA, tokenMintB } = whirlpool.data;
    const decimalsA = tokenMintA.toString() === SOL_MINT.toString() ? 9 : 6;
    const decimalsB = tokenMintB.toString() === SOL_MINT.toString() ? 9 : 6;
  const currentSqrtPrice = whirlpool.data.sqrtPrice;
  const currentPrice = sqrtPriceToPrice(currentSqrtPrice, decimalsA, decimalsB);

  const tokenVaultA = whirlpool.data.tokenVaultA;
  const tokenVaultB = whirlpool.data.tokenVaultB;

    const halfSol = totalSolAmount / 2n;
    
    let swapBatch: SwapAndLiquidityBatch | null = null;
    
    const isTokenASol = tokenMintA.toString() === SOL_MINT.toString();
    const isTokenBSol = tokenMintB.toString() === SOL_MINT.toString();
    
    const solPerPosition = halfSol / BigInt(totalPositions);
    let tokenAPerPosition = 0n;
    let tokenBPerPosition = 0n;
    
    if (isTokenASol) {
      tokenAPerPosition = solPerPosition;
    } else if (isTokenBSol) {
      tokenBPerPosition = solPerPosition;
    }

    if (isTokenASol || isTokenBSol) {
      try {
        const { instructions: swapIxs, quote } = await swapInstructions(
          rpc,
          { 
            inputAmount: halfSol, 
            mint: SOL_MINT 
          },
          poolAddr,
          slippageToleranceBps,
          wallet
        );
        
        const targetToken = isTokenASol ? 'Token B' : 'Token A';
        
        if (isTokenASol) {
          tokenBPerPosition = BigInt(quote.tokenEstOut) / BigInt(totalPositions);
        } else {
          tokenAPerPosition = BigInt(quote.tokenEstOut) / BigInt(totalPositions);
        }
        
        swapBatch = {
          instructions: [
            getSetComputeUnitLimitInstruction({ units: 400_000 }),
            ...swapIxs
          ],
          positionIndices: [],
          description: `Swap ${Number(halfSol) / 1e9} SOL -> ${targetToken}`
        };
        
        console.log(`Swap quote: ${Number(quote.tokenEstOut)} ${targetToken} for ${Number(halfSol) / 1e9} SOL`);
      } catch (err: any) {
        console.error("Failed to generate swap instructions:", err.message);
        // Fallback to price-based calculation if swap generation fails
        if (isTokenASol) {
          tokenBPerPosition = BigInt(Math.floor(Number(solPerPosition) * Number(currentPrice)));
        } else {
          tokenAPerPosition = BigInt(Math.floor(Number(solPerPosition) / Number(currentPrice)));
        }
      }
    }

  const tokenOwnerAccountA = await getAssociatedTokenAddress(tokenMintA, wallet.publicKey);
  const tokenOwnerAccountB = await getAssociatedTokenAddress(tokenMintB, wallet.publicKey);

  const allBatches: SwapAndLiquidityBatch[] = [];

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
      let tickUpper = Math.ceil(tickUpperRaw / tickSpacing) * tickSpacing;
      
      // Ensure tick range is valid: tickLower < tickUpper
      if (tickUpper <= tickLower) {
        tickUpper = tickLower + tickSpacing;
      }

      console.log(`Position ${positionIndex}: tickLower=${tickLower}, tickUpper=${tickUpper}, tickSpacing=${tickSpacing}, targetLowerPrice=${targetLowerPrice}, targetUpperPrice=${targetUpperPrice}`);

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

        const quote = isTokenASol 
          ? increaseLiquidityQuoteA(
              tokenAPerPosition,
              slippageToleranceBps,
              currentSqrtPrice,
              tickLower,
              tickUpper,
              { feeBps: 0, maxFee: 0n }
            )
          : increaseLiquidityQuoteB(
              tokenBPerPosition,
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
        console.error(`Error stack:`, err.stack);
      }
    }

    if (batchInstructions.length > 1) {
      allBatches.push({ 
        instructions: batchInstructions, 
        positionIndices,
        description: `Open + Add liquidity: positions ${positionIndices.join(', ')}`
      });
      console.log(`Added batch with ${batchInstructions.length} instructions for positions ${positionIndices.join(', ')}`);
    } else {
      console.warn(`Skipped batch ${Math.floor(i / CHUNK_SIZE) + 1}: Only ${batchInstructions.length} instructions (need > 1). Position indices: ${positionIndices.join(', ')}`);
    }
  }

  console.log(`Created ${allBatches.length} transaction batches for ${totalPositions} positions with liquidity`);
  
  return {
    swapBatch,
    positionBatches: allBatches,
    totalBatches: allBatches.length + (swapBatch ? 1 : 0),
    totalPositions,
    swapAmount: halfSol,
    tokenAPerPosition,
    tokenBPerPosition,
    positionBundleAddress,
    poolAddress: poolAddr,
    currentPrice: Number(currentPrice)
  };
}

export async function buildAllTransactionsWithLiquidity(
  rpc: Rpc<any>,
  result: CreatePositionsWithLiquidityResult,
  walletPublicKey: Address
): Promise<any[]> {
  const { value: latestBlockhash } = await rpc.getLatestBlockhash().send();
  
  const allBatches: SwapAndLiquidityBatch[] = [];
  
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

export async function signAndSendAllWithLiquidity(
  rpc: Rpc<any>,
  result: CreatePositionsWithLiquidityResult,
  wallet: {
    publicKey: Address;
    signAllTransactions: (txs: any[]) => Promise<any[]>;
  },
  onProgress?: (completed: number, total: number, signature: string, description: string) => void
): Promise<string[]> {
  if (!wallet.signAllTransactions) {
    throw new Error("Wallet does not support signAllTransactions");
  }
  
  const allBatches: SwapAndLiquidityBatch[] = [];
  
  if (result.swapBatch) {
    allBatches.push(result.swapBatch);
  }
  
  allBatches.push(...result.positionBatches);
  
  console.log(`Requesting approval for ${allBatches.length} transactions (swap + positions + liquidity)...`);
  
  const transactionsToSign = await buildAllTransactionsWithLiquidity(
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
  
  console.log("All transactions (swap + positions + liquidity) completed successfully.");
  return results;
}
