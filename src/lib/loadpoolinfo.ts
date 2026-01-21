//AGENT RULE:
//ALWAYS READ THE .nomodify FILE
//BEFORE EDITING AND DO NOT EDIT
//ANY FILES LISTED IN .nomodify

import { setWhirlpoolsConfig, setRpc } from "@orca-so/whirlpools";
import { fetchWhirlpool } from "@orca-so/whirlpools-client";
import { sqrtPriceToPrice } from "@orca-so/whirlpools-core";
import { address, createSolanaRpc } from "@solana/kit";

const KNOWN_TOKENS: Record<string, string> = {
  'So11111111111111111111111111111111111111112': 'SOL',
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': 'USDC',
  'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB': 'USDT',
  'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263': 'BONK',
  '8zGuJvS9mZc96F89GfEByvBky5z6Qonb8fS7Cba2pC9i': 'devUSDC',
  'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So': 'mSOL',
  'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN': 'JUP',
};


export interface PoolData {
  address: string;
  tokenA: {
    mint: string;
    symbol: string;
    decimals: number;
  };
  tokenB: {
    mint: string;
    symbol: string;
    decimals: number;
  };
  currentPrice: number;
  tickSpacing: number;
  currentTick: number;
  sqrtPrice: string;
  liquidity: string;
  feeRate: number;
}

let isConfigured = false;
let cachedRpc: ReturnType<typeof createSolanaRpc> | null = null;
const poolCache: Map<string, PoolData> = new Map();

function getRpc(rpcUrl: string) {
  if (!cachedRpc) {
    cachedRpc = createSolanaRpc(rpcUrl);
  }
  return cachedRpc;
}

async function initializeWhirlpools(rpcUrl: string, network: string) {
  if (isConfigured) return;

  try {
    await setRpc(rpcUrl);
    if (network === "devnet") {
      await setWhirlpoolsConfig("solanaDevnet");
    } else {
      await setWhirlpoolsConfig("solanaMainnet");
    }
    isConfigured = true;
  } catch (error: any) {
    throw new Error(`Whirlpool SDK initialization failed: ${error.message}`);
  }
}

export function getTokenSymbol(mint: string): string {
  return KNOWN_TOKENS[mint] || mint.substring(0, 4) + "...";
}

export async function getPoolData(
  poolAddress: string,
  rpcUrl: string,
  network: string = "mainnet"
): Promise<PoolData> {
  if (poolCache.has(poolAddress)) {
    return poolCache.get(poolAddress)!;
  }

  try {
    await initializeWhirlpools(rpcUrl, network);
    const rpc = getRpc(rpcUrl);

    const whirlpoolAddr = address(poolAddress);
    const whirlpool = await fetchWhirlpool(rpc, whirlpoolAddr);

    if (!whirlpool || !whirlpool.data) {
      throw new Error("Whirlpool not found");
    }

    const data = whirlpool.data;
    const decimalsA = 9;
    const decimalsB = 6;

    const result: PoolData = {
      address: poolAddress,
      tokenA: {
        mint: data.tokenMintA.toString(),
        symbol: getTokenSymbol(data.tokenMintA.toString()),
        decimals: decimalsA,
      },
      tokenB: {
        mint: data.tokenMintB.toString(),
        symbol: getTokenSymbol(data.tokenMintB.toString()),
        decimals: decimalsB,
      },
      currentPrice: sqrtPriceToPrice(data.sqrtPrice, decimalsA, decimalsB),
      tickSpacing: data.tickSpacing,
      currentTick: data.tickCurrentIndex,
      sqrtPrice: data.sqrtPrice.toString(),
      liquidity: data.liquidity.toString(),
      feeRate: data.feeRate,
    };

    poolCache.set(poolAddress, result);
    return result;
  } catch (error: any) {
    throw new Error(`Failed to fetch pool data: ${error.message}`);
  }
}

export function getCachedPool(poolAddress: string): PoolData | undefined {
  return poolCache.get(poolAddress);
}

export function clearPoolCache() {
  poolCache.clear();
}

export function getAllCachedPools(): PoolData[] {
  return Array.from(poolCache.values());
}
