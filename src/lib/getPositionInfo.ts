import { 
  Address, 
  Rpc, 
  address 
} from '@solana/kit';
import { 
  fetchPosition, 
  fetchWhirlpool 
} from '@orca-so/whirlpools-client';
import { 
  sqrtPriceToPrice, 
  tickIndexToPrice 
} from '@orca-so/whirlpools-core';

export interface PositionInfo {
  whirlpool: Address;
  positionMint: Address;
  liquidity: bigint;
  currentPoolPrice: number;
  range: {
    lowerPrice: number;
    upperPrice: number;
    tickLower: number;
    tickUpper: number;
  };
}

export async function getPositionInfo(
  rpc: Rpc<any>,
  positionAddress: Address
): Promise<PositionInfo> {
  const position = await fetchPosition(rpc, positionAddress);

  if (!position || !position.data) {
    throw new Error("Position account not found");
  }

  const { 
    whirlpool: whirlpoolAddr, 
    positionMint, 
    liquidity, 
    tickLowerIndex, 
    tickUpperIndex 
  } = position.data;

  const whirlpool = await fetchWhirlpool(rpc, whirlpoolAddr);

  const decimalsA = 9; 
  const decimalsB = 6;

  const currentPrice = sqrtPriceToPrice(whirlpool.data.sqrtPrice, decimalsA, decimalsB);
  const lowerPrice = tickIndexToPrice(tickLowerIndex, decimalsA, decimalsB);
  const upperPrice = tickIndexToPrice(tickUpperIndex, decimalsA, decimalsB);

  return {
    whirlpool: whirlpoolAddr,
    positionMint,
    liquidity,
    currentPoolPrice: Number(currentPrice),
    range: {
      lowerPrice: Number(lowerPrice),
      upperPrice: Number(upperPrice),
      tickLower: tickLowerIndex,
      tickUpper: tickUpperIndex,
    }
  };
}
