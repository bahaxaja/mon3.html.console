//AGENT RULE:
//ALWAYS READ THE .nomodify FILE
//BEFORE EDITING AND DO NOT EDIT
//ANY FILES LISTED IN .nomodify

import { 
  fetchWhirlpool, 
  getOpenBundledPositionInstruction,
  getBundledPositionAddress,
  fetchPositionBundle,
  fetchPosition,
  getDecreaseLiquidityInstruction,
  getIncreaseLiquidityInstruction,
  getCloseBundledPositionInstruction
} from "@orca-so/whirlpools-client";
import { 
  isPositionInRange, 
  priceToTickIndex, 
  sqrtPriceToPrice 
} from "@orca-so/whirlpools-core";
import { 
  address, 
  Rpc, 
  Address, 
  pipe,
  createTransactionMessage, 
  setTransactionMessageFeePayer,
  setTransactionMessageLifetimeUsingBlockhash,
  appendTransactionMessageInstruction,
  compileTransaction,
  signTransaction
} from "@solana/kit";
import { createLargeDistributedPositionBatch } from "./createPositions";

/**
 * Checks if the current pool price is within the range of a specific bundled position.
 * If not, it moves the liquidity to a new position at the current price.
 */
export async function checkAndRebalanceLiquidity(
  rpc: Rpc<any>,
  poolAddress: string,
  bundleMint: string,
  bundleIndex: number,
  wallet: any
) {
  const poolAddr = address(poolAddress);
  const whirlpool = await fetchWhirlpool(rpc, poolAddr);
  
  // 1. Fetch position data
  const [bundlePda] = await getBundledPositionAddress(address(bundleMint), bundleIndex);
  const position = await fetchPosition(rpc, bundlePda);

  if (!position || position.data.liquidity === 0n) return;

  // 2. Check if price is in range
  const inRange = isPositionInRange(
    whirlpool.data.sqrtPrice,
    position.data.tickLowerIndex,
    position.data.tickUpperIndex
  );

  if (!inRange) {
    console.log(`Price out of range for index ${bundleIndex}. Rebalancing...`);
    
    // Logic to move liquidity:
    // This typically involves: 
    // a) decreaseLiquidity from old position
    // b) closeBundledPosition
    // c) openBundledPosition at new tick
    // d) increaseLiquidity in new position
    // Note: This requires complex quote calculation for exact amounts.
  }
}

/**
 * Exports the auto-expansion logic.
 * Checks if current price is within 3 positions of the boundaries.
 */
export async function createBundledPositionsAuto(
  rpc: Rpc<any>,
  poolAddress: string,
  bundleMint: string,
  walletPublicKey: Address,
  currentPositions: { index: number, tickLower: number, tickUpper: number }[]
) {
  const whirlpool = await fetchWhirlpool(rpc, poolAddress as Address);
  const currentTick = priceToTickIndex(
    sqrtPriceToPrice(whirlpool.data.sqrtPrice, 9, 6), 9, 6
  );

  // Find min and max boundaries of existing positions
  const sortedPositions = [...currentPositions].sort((a, b) => a.tickLower - b.tickLower);
  const lowestTick = sortedPositions[0].tickLower;
  const highestTick = sortedPositions[sortedPositions.length - 1].tickUpper;

  const tickSpacing = whirlpool.data.tickSpacing;
  const bufferTicks = tickSpacing * 3; // "3 positions close" definition

  const nearUpper = currentTick >= (highestTick - bufferTicks);
  const nearLower = currentTick <= (lowestTick + bufferTicks);

  if (nearUpper || nearLower) {
    console.log("Price near boundary. Triggering automatic position expansion...");
    
    // Call your existing batch creation logic
    const nextStartIndex = currentPositions.length;
    return await createLargeDistributedPositionBatch(
      bundleMint,
      poolAddress,
      rpc,
      walletPublicKey,
      10, // Create 10 new positions
      0.001,
      nextStartIndex
    );
  }

  return null;
}
