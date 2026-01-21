//AGENT RULE:
//ALWAYS READ THE .nomodify FILE
//BEFORE EDITING AND DO NOT EDIT
//ANY FILES LISTED IN .nomodify

import { Connection, Keypair, PublicKey, TransactionMessage, VersionedTransaction } from '@solana/web3.js';
import { 
  address, 
  getProgramDerivedAddress, 
  getAddressEncoder,
  createKeyPairSignerFromBytes,
  createSolanaRpc
} from '@solana/kit';
import { findAssociatedTokenPda, TOKEN_PROGRAM_ADDRESS } from '@solana-program/token';
import { 
  getInitializePositionBundleInstruction, 
  getPositionBundleAddress,
} from '@orca-so/whirlpools-client';

export interface PendingDownload {
  filename: string;
  content: string;
  mimeType: string;
}

let pendingDownloads: PendingDownload[] = [];
let downloadCallback: ((downloads: PendingDownload[]) => void) | null = null;

export function setDownloadCallback(callback: ((downloads: PendingDownload[]) => void) | null) {
  downloadCallback = callback;
}

export function getPendingDownloads(): PendingDownload[] {
  return pendingDownloads;
}

export function clearPendingDownloads() {
  pendingDownloads = [];
}

function triggerDownload(content: string, filename: string, mimeType: string) {
  const download: PendingDownload = { filename, content, mimeType };
  pendingDownloads.push(download);
  
  if (downloadCallback) {
    downloadCallback([...pendingDownloads]);
  }
  
  // Also try the standard download approach
  const blob = new Blob([content], { type: mimeType });
  const reader = new FileReader();
  reader.onload = () => {
    const dataUrl = reader.result as string;
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    setTimeout(() => {
      a.click();
      setTimeout(() => {
        document.body.removeChild(a);
      }, 200);
    }, 100);
  };
  reader.readAsDataURL(blob);
}

export interface InitBundleParams {
  publicKey: PublicKey;
  connection: Connection;
  selectedWhirlpool: { address: string };
  sendTransaction: (
    transaction: VersionedTransaction,
    connection: Connection,
    options?: any
  ) => Promise<string>;
  addLog: (message: string, type: 'info' | 'error' | 'success') => void;
}

export interface BundleData {
  positionBundleMint: string;
  positionBundleMintSecretKey: number[];
  positionBundlePda: string;
  positionBundlePdaBump: number;
  ataAddress: string;
  ataBump: number;
  metadataPda: string;
  owner: string;
  whirlpool: string;
  createdAt: string;
  txSignature: string;
}

export async function initializePositionBundle(params: InitBundleParams): Promise<BundleData | null> {
  const { publicKey, connection, selectedWhirlpool, sendTransaction, addLog } = params;
  
  const ownerAddr = address(publicKey.toBase58());
  
  const rpcUrl = connection.rpcEndpoint;
  const rpc = createSolanaRpc(rpcUrl);
  
  const web3MintKeypair = Keypair.generate();
  const mintSecretKeyBytes = web3MintKeypair.secretKey;
  
  const positionBundleMintSigner = await createKeyPairSignerFromBytes(mintSecretKeyBytes);
  const positionBundleMintAddr = positionBundleMintSigner.address;
    
  addLog(`Generated bundle mint: ${positionBundleMintAddr}`, 'info');  
  
  const ataPdaResult = await findAssociatedTokenPda({
    mint: positionBundleMintAddr,
    owner: ownerAddr,
    tokenProgram: TOKEN_PROGRAM_ADDRESS,
  });
  const ataAddress = ataPdaResult[0];
  const ataBump = ataPdaResult[1];
  addLog(`Derived ATA: ${ataAddress} (bump: ${ataBump})`, 'info');
  
  const positionBundlePdaResult = await getPositionBundleAddress(positionBundleMintAddr);
  const positionBundlePda = positionBundlePdaResult[0];
  const positionBundlePdaBump = positionBundlePdaResult[1];
  addLog(`Derived Position Bundle PDA: ${positionBundlePda} (bump: ${positionBundlePdaBump})`, 'info');
  
  const METADATA_PROGRAM_ID = address("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s");
  const metadataPdaResult = await getProgramDerivedAddress({
    programAddress: METADATA_PROGRAM_ID,
    seeds: [
      new TextEncoder().encode("metadata"),
      getAddressEncoder().encode(METADATA_PROGRAM_ID),
      getAddressEncoder().encode(positionBundleMintAddr)
    ]
  });
  const metadataPda = metadataPdaResult[0];
  addLog(`Derived Metadata PDA: ${metadataPda}`, 'info');
  
  addLog('Building initializePositionBundle transaction...', 'info');  

  const instruction = getInitializePositionBundleInstruction({  
    positionBundle: positionBundlePda,
    positionBundleMint: positionBundleMintSigner as any,
    positionBundleTokenAccount: ataAddress,
    positionBundleOwner: ownerAddr,  
    funder: ownerAddr as any,  
  });  

  const { value: latestBlockhash } = await rpc.getLatestBlockhash().send();

  const web3Instruction = {
    programId: new PublicKey(instruction.programAddress),
    keys: instruction.accounts.map((acc: any) => ({
      pubkey: new PublicKey(acc.address),
      isSigner: acc.role === 3 || acc.role === 2,
      isWritable: acc.role === 3 || acc.role === 1,
    })),
    data: Buffer.from(instruction.data || []),
  };

  const txMessage = new TransactionMessage({
    payerKey: publicKey,
    recentBlockhash: latestBlockhash.blockhash,
    instructions: [web3Instruction],
  }).compileToV0Message();

  const transaction = new VersionedTransaction(txMessage);
  
  transaction.sign([web3MintKeypair]);
  
  const signature = await sendTransaction(transaction, connection, {
    skipPreflight: false,
    preflightCommitment: 'confirmed',
  });
  
  addLog(`Transaction sent: ${signature}`, 'info');
  
  await connection.confirmTransaction({ 
    signature, 
    blockhash: latestBlockhash.blockhash, 
    lastValidBlockHeight: Number(latestBlockhash.lastValidBlockHeight) 
  }, 'confirmed');
    
  addLog(`Transaction confirmed: ${signature}`, 'success');  
  addLog(`Position Bundle initialized!`, 'success');
  
    const mintSecretKeyArray = Array.from(mintSecretKeyBytes);
    let keypairDownloadData: any = null;
    try {
      const keypairRes = await fetch('/api/keypair', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mint: positionBundleMintAddr.toString(),
          secretKey: mintSecretKeyArray,
          publicKey: positionBundleMintAddr.toString(),
          type: 'positionBundleMint'
        })
      });
      const keypairResult = await keypairRes.json();
      if (keypairResult.downloadData) {
        keypairDownloadData = keypairResult.downloadData;
        triggerDownload(
          JSON.stringify(keypairResult.downloadData, null, 2),
          keypairResult.filename,
          'application/json'
        );
      }
      addLog(`Keypair saved to dist/style/${positionBundleMintAddr}.json`, 'success');
    } catch (kpErr: any) {
      addLog(`Failed to save keypair: ${kpErr.message}`, 'error');
    }

  const bundleData: BundleData = {
    positionBundleMint: positionBundleMintAddr.toString(),
    positionBundleMintSecretKey: mintSecretKeyArray,
    positionBundlePda: positionBundlePda.toString(),
    positionBundlePdaBump,
    ataAddress: ataAddress.toString(),
    ataBump,
    metadataPda: metadataPda.toString(),
    owner: publicKey.toBase58(),
    whirlpool: selectedWhirlpool.address,
    createdAt: new Date().toISOString(),
    txSignature: signature
  };
  
  try {
    const cacheRes = await fetch('/api/pool-cache');
    const cacheData = await cacheRes.json();
    const updatedData = {
      ...cacheData,
      bundles: [...(cacheData.bundles || []), bundleData]
    };
    await fetch('/api/pool-cache', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatedData)
    });
    addLog('Bundle data saved to temppool.json', 'success');
  } catch (saveErr: any) {
    addLog(`Failed to save bundle data: ${saveErr.message}`, 'error');
  }

    try {
      const bundleFileData = {
        ...bundleData,
        poolInfo: null
      };
      
      try {
        const poolCacheRes = await fetch('/api/pool-cache');
        const poolCacheData = await poolCacheRes.json();
        if (poolCacheData.address) {
          bundleFileData.poolInfo = {
            address: poolCacheData.address,
            tickSpacing: poolCacheData.tickSpacing,
            currentPrice: poolCacheData.currentPrice,
            currentTick: poolCacheData.currentTick,
            tokenA: poolCacheData.tokenA,
            tokenB: poolCacheData.tokenB,
            liquidity: poolCacheData.liquidity,
            feeRate: poolCacheData.feeRate,
            sqrtPrice: poolCacheData.sqrtPrice
          };
        }
      } catch {}
      
      const bundleCacheRes = await fetch('/api/bundle-cache', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(bundleFileData)
        });
        const bundleCacheResult = await bundleCacheRes.json();
        if (bundleCacheResult.downloadData) {
          triggerDownload(
            JSON.stringify(bundleCacheResult.downloadData, null, 2),
            bundleCacheResult.filename,
            'application/json'
          );
        }
        addLog(`Bundle #${bundleCacheResult.bundleNumber} saved: ${bundleCacheResult.filename}`, 'success');
    } catch (bundleSaveErr: any) {
      addLog(`Failed to save bundle file: ${bundleSaveErr.message}`, 'error');
    }
  
    let pinataUrl = '';
    let pinataMetadata: any = null;
    try {
      addLog('Uploading bundle metadata to Pinata...', 'info');
      pinataMetadata = {
        name: "Whirlpool Position Bundle",
        symbol: "WPB",
        description: "A bundle of 256 liquidity positions in Orca Whirlpools",
        image: "https://arweave.net/yT7KTLqDZzZL1JNF9gRCDj_WZt0ak8tNmN9TMNOFY_w",
        external_url: "https://orca.so",
        attributes: [
          { trait_type: "Type", value: "Position Bundle" },
          { trait_type: "Capacity", value: "256 positions" },
          { trait_type: "Mint", value: bundleData.positionBundleMint },
          { trait_type: "Whirlpool", value: bundleData.whirlpool },
          { trait_type: "Owner", value: bundleData.owner }
        ],
        properties: {
          category: "image",
          files: [{ uri: "https://arweave.net/yT7KTLqDZzZL1JNF9gRCDj_WZt0ak8tNmN9TMNOFY_w", type: "image/png" }],
          creators: [{ address: bundleData.owner, share: 100 }]
        },
        bundleData: {
          mint: bundleData.positionBundleMint,
          pda: bundleData.positionBundlePda,
          ata: bundleData.ataAddress,
          metadataPda: bundleData.metadataPda,
          whirlpool: bundleData.whirlpool,
          txSignature: bundleData.txSignature,
          createdAt: bundleData.createdAt
        }
      };

      const pinataRes = await fetch('/api/pinata', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'uploadJson',
          jsonData: pinataMetadata
        })
      });
      
      if (pinataRes.ok) {
        const pinataResult = await pinataRes.json();
        pinataUrl = pinataResult.metadataUrl;
        addLog(`Metadata uploaded to Pinata: ${pinataResult.cid}`, 'success');
        addLog(`Metadata URL: ${pinataUrl}`, 'success');
      } else {
        addLog('Failed to upload to Pinata (check PINATA_JWT and PINATA_GATEWAY env vars)', 'error');
      }
    } catch (pinataErr: any) {
      addLog(`Pinata upload error: ${pinataErr.message}`, 'error');
    }

    const consoleLog = [
      '',
      '═══════════════════════════════════════════════════════════',
      '           POSITION BUNDLE INITIALIZED',
      '═══════════════════════════════════════════════════════════',
      '',
      `MINT:              ${bundleData.positionBundleMint}`,
      `PDA:               ${bundleData.positionBundlePda}`,
      `PDA BUMP:          ${bundleData.positionBundlePdaBump}`,
      `ATA:               ${bundleData.ataAddress}`,
      `ATA BUMP:          ${bundleData.ataBump}`,
      `METADATA PDA:      ${bundleData.metadataPda}`,
      `OWNER:             ${bundleData.owner}`,
      `WHIRLPOOL:         ${bundleData.whirlpool}`,
      `TX SIGNATURE:      ${bundleData.txSignature}`,
      '',
      `KEYPAIR FILE:      dist/style/${bundleData.positionBundleMint}.json`,
      `BUNDLE FILE:       public/style/{randomwords}-{bundlenum}-${bundleData.positionBundleMint}.json`,
      `BUNDLE DATA:       temppool.json`,
      '',
      '───────────────────────────────────────────────────────────',
      '               PINATA METADATA',
      '───────────────────────────────────────────────────────────',
      ...(pinataMetadata ? [
        `NAME:              ${pinataMetadata.name}`,
        `SYMBOL:            ${pinataMetadata.symbol}`,
        `DESCRIPTION:       ${pinataMetadata.description}`,
        `IMAGE:             ${pinataMetadata.image}`,
        `EXTERNAL URL:      ${pinataMetadata.external_url}`,
        pinataUrl ? `PINATA URL:        ${pinataUrl}` : '',
        `ATTRIBUTES:        ${pinataMetadata.attributes.length} traits`,
        ...pinataMetadata.attributes.map((attr: any) => `  • ${attr.trait_type}: ${attr.value}`),
      ] : ['NO PINATA METADATA']),
      '',
      '═══════════════════════════════════════════════════════════',
    ].filter(Boolean).join('\n');
    addLog(consoleLog, 'success');
    
    console.log('%c\n' + consoleLog, 'color: #22c55e; font-weight: bold');
    console.log('%cBundle Data JSON:', 'color: #eab308; font-weight: bold');
    console.log(JSON.stringify(bundleData, null, 2));
    if (pinataMetadata) {
      console.log('%cPinata Metadata JSON:', 'color: #3b82f6; font-weight: bold');
      console.log(JSON.stringify(pinataMetadata, null, 2));
    }
    
    return { ...bundleData, pinataUrl };
}

export async function loadAndDisplayBundle(
  bundleAddress: string, 
  addLog: (message: string, type: 'info' | 'error' | 'success') => void
): Promise<void> {
  try {
    // Try to fetch bundle data from cache
    const response = await fetch(`/api/bundle-cache?mint=${bundleAddress}`);
    if (!response.ok) {
      addLog(`Bundle not found: ${bundleAddress}`, 'error');
      return;
    }

    const bundleData = await response.json();
    
    if (!bundleData) {
      addLog('Invalid bundle data received', 'error');
      return;
    }

    // Construct pinata metadata from bundle data if available
    let pinataMetadata: any = null;
    if (bundleData.poolInfo) {
      pinataMetadata = {
        name: bundleData.name || "Whirlpool Position Bundle",
        symbol: bundleData.symbol || "WPB",
        description: "A bundle of 256 liquidity positions in Orca Whirlpools",
        image: "https://arweave.net/yT7KTLqDZzZL1JNF9gRCDj_WZt0ak8tNmN9TMNOFY_w",
        external_url: "https://orca.so",
        attributes: [
          { trait_type: "Type", value: "Position Bundle" },
          { trait_type: "Capacity", value: "256 positions" },
          { trait_type: "Mint", value: bundleData.positionBundleMint },
          { trait_type: "Whirlpool", value: bundleData.whirlpool },
          { trait_type: "Owner", value: bundleData.owner },
          { trait_type: "Positions", value: bundleData.positions?.length || 0 }
        ],
        properties: {
          category: "image",
          files: [{ uri: "https://arweave.net/yT7KTLqDZzZL1JNF9gRCDj_WZt0ak8tNmN9TMNOFY_w", type: "image/png" }],
          creators: [{ address: bundleData.owner, share: 100 }]
        },
        bundleData: {
          mint: bundleData.positionBundleMint,
          pda: bundleData.positionBundlePda,
          ata: bundleData.ataAddress,
          metadataPda: bundleData.metadataPda,
          whirlpool: bundleData.whirlpool,
          txSignature: bundleData.txSignature,
          createdAt: bundleData.createdAt
        }
      };
    }

    const consoleLog = [
      '',
      '═══════════════════════════════════════════════════════════',
      '           POSITION BUNDLE LOADED',
      '═══════════════════════════════════════════════════════════',
      '',
      `MINT:              ${bundleData.positionBundleMint}`,
      `PDA:               ${bundleData.positionBundlePda}`,
      `ATA:               ${bundleData.ataAddress}`,
      `METADATA PDA:      ${bundleData.metadataPda}`,
      `OWNER:             ${bundleData.owner}`,
      `WHIRLPOOL:         ${bundleData.whirlpool}`,
      `TX SIGNATURE:      ${bundleData.txSignature}`,
      `CREATED:           ${bundleData.createdAt}`,
      '',
      `POSITIONS:         ${bundleData.positions?.length || bundleData.occupiedCount || 0}/256`,
      '',
      ...(bundleData.poolInfo ? [
        `POOL INFO:`,
        `  Pool Address:   ${bundleData.poolInfo.address}`,
        `  Token A:        ${bundleData.poolInfo.tokenA?.symbol || 'Unknown'} (${bundleData.poolInfo.tokenA?.decimals || 0} decimals)`,
        `  Token B:        ${bundleData.poolInfo.tokenB?.symbol || 'Unknown'} (${bundleData.poolInfo.tokenB?.decimals || 0} decimals)`,
        `  Current Price:  ${bundleData.poolInfo.currentPrice}`,
        `  Current Tick:   ${bundleData.poolInfo.currentTick}`,
        `  Liquidity:      ${bundleData.poolInfo.liquidity}`,
        `  Fee Rate:       ${bundleData.poolInfo.feeRate}`,
        ''
      ] : []),
      '───────────────────────────────────────────────────────────',
      '               PINATA METADATA',
      '───────────────────────────────────────────────────────────',
      ...(pinataMetadata ? [
        `NAME:              ${pinataMetadata.name}`,
        `SYMBOL:            ${pinataMetadata.symbol}`,
        `DESCRIPTION:       ${pinataMetadata.description}`,
        `IMAGE:             ${pinataMetadata.image}`,
        `EXTERNAL URL:      ${pinataMetadata.external_url}`,
        `ATTRIBUTES:        ${pinataMetadata.attributes.length} traits`,
        ...pinataMetadata.attributes.map((attr: any) => `  • ${attr.trait_type}: ${attr.value}`),
      ] : ['NO PINATA METADATA']),
      '',
      '═══════════════════════════════════════════════════════════',
    ].filter(Boolean).join('\n');

    addLog(consoleLog, 'success');
    
    console.log('%c\n' + consoleLog, 'color: #22c55e; font-weight: bold');
    console.log('%cBundle Data JSON:', 'color: #eab308; font-weight: bold');
    console.log(JSON.stringify(bundleData, null, 2));
    if (pinataMetadata) {
      console.log('%cPinata Metadata JSON:', 'color: #3b82f6; font-weight: bold');
      console.log(JSON.stringify(pinataMetadata, null, 2));
    }

    addLog(`Bundle loaded successfully: ${bundleData.positionBundleMint}`, 'success');
  } catch (err: any) {
    addLog(`Failed to load bundle: ${err.message}`, 'error');
    console.error('Bundle load error:', err);
  }
}

