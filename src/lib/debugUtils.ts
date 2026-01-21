/**
 * Debug Utilities for Position Creation
 * Provides validation and logging functions for address verification
 */

import { Address } from "@solana/kit";

/**
 * Validates if a string is a valid base58 address
 */
export function isValidBase58Address(addr: string): boolean {
  if (!addr || typeof addr !== 'string') return false;
  // Base58 alphabet
  const base58Alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(addr) && 
    addr.split('').every(char => base58Alphabet.includes(char));
}

/**
 * Validates wallet address
 */
export function validateWalletAddress(address: Address | string, label: string = "Wallet"): {
  valid: boolean;
  message: string;
} {
  const addrStr = typeof address === 'string' ? address : address.toString?.();
  
  if (!addrStr) {
    return { valid: false, message: `${label}: Address is null or undefined` };
  }

  if (!isValidBase58Address(addrStr)) {
    return { valid: false, message: `${label}: Invalid base58 format - "${addrStr}"` };
  }

  if (addrStr.length < 32 || addrStr.length > 44) {
    return { valid: false, message: `${label}: Invalid length (${addrStr.length}) - expected 32-44 characters` };
  }

  return { valid: true, message: `${label}: Valid ✓` };
}

/**
 * Logs all addresses used in position creation with validation
 */
export function logAddressDebugInfo(params: {
  bundleMint: Address;
  bundleTokenAccount: Address;
  poolAddress: Address;
  walletPublicKey: Address;
  tokenMintA: Address;
  tokenMintB: Address;
  tokenVaultA: Address;
  tokenVaultB: Address;
  positionBundleAddress: Address;
  tokenOwnerAccountA: Address;
  tokenOwnerAccountB: Address;
}): void {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('📋 ADDRESS VALIDATION REPORT');
  console.log('═══════════════════════════════════════════════════════════');

  const addresses = {
    'Bundle Mint': params.bundleMint,
    'Bundle Token Account': params.bundleTokenAccount,
    'Pool Address': params.poolAddress,
    'Wallet Public Key': params.walletPublicKey,
    'Token Mint A': params.tokenMintA,
    'Token Mint B': params.tokenMintB,
    'Token Vault A': params.tokenVaultA,
    'Token Vault B': params.tokenVaultB,
    'Position Bundle Address': params.positionBundleAddress,
    'Token Owner Account A': params.tokenOwnerAccountA,
    'Token Owner Account B': params.tokenOwnerAccountB,
  };

  let allValid = true;

  for (const [label, addr] of Object.entries(addresses)) {
    const validation = validateWalletAddress(addr, label);
    const icon = validation.valid ? '✓' : '✗';
    const color = validation.valid ? '\x1b[32m' : '\x1b[31m';
    console.log(`${color}${icon}\x1b[0m ${validation.message}`);
    if (!validation.valid) allValid = false;
  }

  console.log('═══════════════════════════════════════════════════════════');
  if (allValid) {
    console.log('✓ All addresses are valid!');
  } else {
    console.log('✗ Some addresses are invalid! Check configuration.');
  }
  console.log('═══════════════════════════════════════════════════════════\n');
}

/**
 * Logs token configuration details
 */
export function logTokenConfig(params: {
  tokenMintA: Address;
  tokenMintB: Address;
  decimalsA: number;
  decimalsB: number;
  currentPrice: number;
  currentSqrtPrice: bigint;
  tickSpacing: number;
}): void {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('💰 TOKEN CONFIGURATION');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`Token A: ${params.tokenMintA.toString().slice(0, 12)}... (${params.decimalsA} decimals)`);
  console.log(`Token B: ${params.tokenMintB.toString().slice(0, 12)}... (${params.decimalsB} decimals)`);
  console.log(`Current Price: ${params.currentPrice.toFixed(6)}`);
  console.log(`Current Sqrt Price: ${params.currentSqrtPrice.toString()}`);
  console.log(`Tick Spacing: ${params.tickSpacing}`);
  console.log('═══════════════════════════════════════════════════════════\n');
}

/**
 * Logs position creation parameters
 */
export function logPositionParams(params: {
  totalPositions: number;
  totalSolAmount: bigint;
  rangePercent: number;
  tokenAPerPosition: bigint;
  tokenBPerPosition: bigint;
  startIndex: number;
  slippageToleranceBps: number;
}): void {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('📊 POSITION CREATION PARAMETERS');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`Total Positions: ${params.totalPositions}`);
  console.log(`Total SOL Amount: ${Number(params.totalSolAmount) / 1e9}`);
  console.log(`Range Per Position: ${(params.rangePercent * 100).toFixed(4)}%`);
  console.log(`Token A Per Position: ${Number(params.tokenAPerPosition) / 1e9}`);
  console.log(`Token B Per Position: ${Number(params.tokenBPerPosition) / 1e6}`);
  console.log(`Start Index: ${params.startIndex}`);
  console.log(`Slippage Tolerance: ${params.slippageToleranceBps} bps`);
  console.log('═══════════════════════════════════════════════════════════\n');
}

/**
 * Logs wallet connection status
 */
export function logWalletStatus(params: {
  walletPublicKey: Address | null;
  isConnected: boolean;
  supportsSignAllTransactions: boolean;
  walletName?: string;
}): void {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🔌 WALLET CONNECTION STATUS');
  console.log('═══════════════════════════════════════════════════════════');
  
  const connectionStatus = params.isConnected ? '✓ Connected' : '✗ Disconnected';
  console.log(`Status: ${connectionStatus}`);
  
  if (params.walletName) {
    console.log(`Wallet: ${params.walletName}`);
  }
  
  if (params.walletPublicKey) {
    const validation = validateWalletAddress(params.walletPublicKey, 'Public Key');
    console.log(`${validation.valid ? '✓' : '✗'} ${validation.message}`);
  } else {
    console.log('✗ Public Key: Not available');
  }
  
  const signStatus = params.supportsSignAllTransactions ? '✓ Supported' : '✗ Not supported';
  console.log(`SignAllTransactions: ${signStatus}`);
  
  console.log('═══════════════════════════════════════════════════════════\n');
}

/**
 * Validates all inputs before position creation
 */
export function validatePositionCreationInputs(params: {
  bundleMintAddress: string;
  poolAddress: string;
  totalPositions: number;
  rangePercent: number;
  totalSolAmount: bigint;
  walletPublicKey: Address | null;
}): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Validate bundle mint
  if (!isValidBase58Address(params.bundleMintAddress)) {
    errors.push(`Invalid bundle mint address: "${params.bundleMintAddress}"`);
  }

  // Validate pool address
  if (!isValidBase58Address(params.poolAddress)) {
    errors.push(`Invalid pool address: "${params.poolAddress}"`);
  }

  // Validate positions count
  if (params.totalPositions <= 0 || params.totalPositions > 1000) {
    errors.push(`Invalid totalPositions: ${params.totalPositions} (must be 1-1000)`);
  }

  // Validate range percent
  if (params.rangePercent <= 0 || params.rangePercent > 100) {
    errors.push(`Invalid rangePercent: ${params.rangePercent} (must be 0-100)`);
  }

  // Validate SOL amount
  if (params.totalSolAmount <= 0n) {
    errors.push(`Invalid totalSolAmount: must be greater than 0`);
  }

  // Validate wallet
  if (!params.walletPublicKey) {
    errors.push(`Wallet not connected`);
  } else {
    const validation = validateWalletAddress(params.walletPublicKey, 'Wallet');
    if (!validation.valid) {
      errors.push(validation.message);
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}
