# Position Creation Debugging Guide

## Overview
This guide helps you debug issues when creating positions in the Whirlpool Position Manager. The application now includes comprehensive logging and validation utilities.

## 1. Validation Checks

### Input Validation
Before attempting to create positions, the system validates:
- ✓ Bundle Mint Address (valid base58 format)
- ✓ Pool Address (valid base58 format)
- ✓ Total Positions (1-1000 range)
- ✓ Range Percent (0-100 range)
- ✓ Total SOL Amount (> 0)
- ✓ Wallet Connection

### Address Format Validation
All addresses are checked to ensure they are:
- Valid base58 encoding (only alphanumeric characters from base58 alphabet)
- Proper length (32-44 characters)
- Non-null and non-undefined

## 2. Debugging Steps

### Step 1: Check Wallet Connection
**Error Message**: "Wallet does not support signAllTransactions"

**Solution**:
- Ensure you're using Phantom, Solflare, or similar wallet that supports batch signing
- Check that the wallet is actually connected (green indicator in UI)
- Log output will show: `🔌 WALLET CONNECTION STATUS`

**What to verify**:
```
- Status: ✓ Connected
- Public Key: Valid ✓
- SignAllTransactions: ✓ Supported
```

### Step 2: Verify Token Mints
**Error Message**: "Failed to fetch whirlpool data"

**Solution**:
- Ensure the pool address is correct (from loadpoolinfo.ts)
- Verify token mint addresses match the actual pool tokens
- Check token decimals (should be 9 for SOL, 6 for other tokens)

**What to look for in logs**:
```
💰 TOKEN CONFIGURATION
Token A: So11111111... (9 decimals)
Token B: EPjFWaJ... (6 decimals)
Current Price: X.XXXXXX
Tick Spacing: 64
```

### Step 3: Validate Bundle Configuration
**Error Message**: "Bundle ATA not found in loaded bundle data"

**Solution**:
- Click "LOAD BUNDLE" first to populate the bundle data
- Ensure the NFT address (Bundle Mint) is correct
- Bundle must already exist on the blockchain

**Debug Output**:
```
✓ Bundle Mint: 3UjRhvFYjH...
✓ Pool Address: 6LHH7Yej8m...
✓ Bundle ATA: 8fxUqqQqQy...
✓ Wallet: 9B85To8tBC...
```

### Step 4: Check Position Parameters
**Error Message**: "No position batches were created"

**Root Causes**:
1. **rangePercent is too small**: The calculated tick ranges collapse to invalid ranges
2. **Tick spacing incompatibility**: The pool's tickSpacing doesn't align with your price range
3. **All positions failed validation**: Each position in the try-catch block failed
4. **Price range calculation error**: Invalid tick index conversion

**Solutions**:

Option 1: Increase rangePercent
```
Current: 0.001 (too small)
Try: 0.1 or higher
The range must be large enough to generate valid tick ranges
```

Option 2: Adjust total positions
```
Current: Too many positions spread over a small range
Try: Fewer positions (e.g., 5-10 instead of 50)
```

Option 3: Check console logs for specific errors
```
Open browser DevTools (F12) → Console
Look for: "Failed to create instruction for position X:"
Note the specific error message
```

Option 4: Verify pool tickSpacing compatibility
```
Some pools have tickSpacing of 64 or 128
Ensure your price range aligns with these boundaries
```

**Debug Output**:
```
📊 POSITION CREATION PARAMETERS
Total Positions: 20
Total SOL Amount: 1
Range Per Position: 0.1000%
Token A Per Position: 0.05
Token B Per Position: 8333.33
Start Index: 0
Slippage Tolerance: 100 bps
```

**Console Debug Output to Check**:
```
Position 0: tickLower=1234560, tickUpper=1234624, tickSpacing=64
Position 1: tickLower=1234496, tickUpper=1234560, tickSpacing=64
...
Added batch with 3 instructions for positions 0, 1
```

If you see:
- `Skipped batch X: Only 1 instruction` → All positions in that batch failed
- `Failed to create instruction for position X: [error message]` → See that specific error


## 3. Common Issues and Fixes

### Issue: "Invalid base58 address"
**Cause**: Malformed address in the input field

**Fix**:
```
1. Copy address from blockchain explorer (Solscan, MagicEden)
2. Paste directly into the input field
3. Verify no extra spaces or characters
4. Check length: should be 32-44 characters
```

### Issue: "Validation errors"
**Cause**: One or more input parameters are invalid

**Fix**:
```
Check each parameter:
- numPositions: Change to 20
- rangePercent: Change to 0.1
- fundAmount: Change to 1
- Bundle Mint: Re-paste from blockchain explorer
- Pool Address: Verify it's loaded in dropdown
```

### Issue: "Failed to create instruction for position"
**Cause**: Invalid tick range calculations

**Possible fixes**:
```
1. Reduce rangePercent (try 0.05 instead of 1.0)
2. Increase startIndex to avoid conflicts
3. Check pool has sufficient liquidity
4. Verify pool is not paused
```

## 4. Console Debugging

### Enable Console Logging
1. Open browser Developer Tools (F12 or Ctrl+Shift+I)
2. Go to "Console" tab
3. All logs will appear with color coding:
   - **Green** (✓): Successful operations
   - **Red** (✗): Errors
   - **Blue**: Information messages

### Key Log Messages to Look For

#### Connection Validation
```
═══════════════════════════════════════════════════════════
🔌 WALLET CONNECTION STATUS
═══════════════════════════════════════════════════════════
✓ Status: Connected
✓ Wallet: Phantom
✓ Public Key: Valid ✓
✓ SignAllTransactions: Supported
```

#### Address Validation Report
```
═══════════════════════════════════════════════════════════
📋 ADDRESS VALIDATION REPORT
═══════════════════════════════════════════════════════════
✓ Bundle Mint: Valid ✓
✓ Bundle Token Account: Valid ✓
✓ Pool Address: Valid ✓
✓ Wallet Public Key: Valid ✓
... (more addresses)
═══════════════════════════════════════════════════════════
✓ All addresses are valid!
```

## 5. Manual Testing Checklist

Before creating positions, verify:

```
□ Wallet is connected (green indicator)
□ Wallet supports signAllTransactions (not WalletConnect)
□ Bundle Mint address is loaded and valid
□ Pool is selected from dropdown
□ numPositions is between 1-1000 (try 20)
□ rangePercent is > 0 (try 0.1)
□ fundAmount is > 0 (try 1 SOL)
□ Console shows no validation errors
□ All addresses are showing as "Valid ✓"
□ Network is set to Mainnet/Devnet correctly
```

## 6. Debug Utils API

### `validateWalletAddress(address, label)`
Returns validation result for any address:
```typescript
const result = validateWalletAddress(someAddress, "My Address");
// { valid: true, message: "My Address: Valid ✓" }
```

### `logWalletStatus(params)`
Logs comprehensive wallet connection info to console:
```typescript
logWalletStatus({
  walletPublicKey,
  isConnected: true,
  supportsSignAllTransactions: true,
  walletName: "Phantom"
});
```

### `validatePositionCreationInputs(params)`
Returns validation result with all errors listed:
```typescript
const validation = validatePositionCreationInputs({
  bundleMintAddress,
  poolAddress,
  totalPositions,
  rangePercent,
  totalSolAmount,
  walletPublicKey
});
// { valid: true, errors: [] }
```

## 7. Network Configuration

### Testnet vs Mainnet
Make sure you're on the correct network:
- **Devnet**: Test addresses, no real SOL
- **Mainnet Beta**: Real SOL, real tokens

Check in:
1. Your wallet app (bottom-left usually)
2. Explorer URL bar (api.devnet.solana.com vs api.mainnet-beta.solana.com)
3. Application logs should show network in RPC connection

## 8. Getting Help

### Information to Include When Asking for Help
```
1. Full error message from console (F12 → Console)
2. Output from validation logs
3. Wallet name and version
4. Network being used (Devnet/Mainnet)
5. Bundle Mint address (partial, e.g., "6LHH7Y...")
6. Pool address being used
```

### Quick Diagnostics
Run in browser console to get full debug info:
```javascript
// Get full wallet info
console.log('Public Key:', window.publicKey?.toString());

// Validate an address
const { validateWalletAddress } = await import('@/lib/debugUtils');
validateWalletAddress('your-address-here', 'Test Address');
```

---

**Last Updated**: 2026-01-16
**Debug Utils Version**: 1.0
