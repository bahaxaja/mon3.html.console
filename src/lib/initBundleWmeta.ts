//AGENT RULE:
//ALWAYS READ THE .nomodify FILE
//BEFORE EDITING AND DO NOT EDIT
//ANY FILES LISTED IN .nomodify

import { 
  Connection, 
  Keypair, 
  PublicKey, 
  TransactionMessage, 
  VersionedTransaction 
} from '@solana/web3.js';
import { 
  address, 
  generateKeyPairSigner, 
  pipe, 
  createTransactionMessage, 
  setTransactionMessageFeePayer, 
  setTransactionMessageLifetimeUsingBlockhash, 
  appendTransactionMessageInstruction, 
  compileTransaction, 
  signTransaction,
  createSolanaRpc,
  Address
} from '@solana/kit';
import { getInitializePositionBundleInstruction } from '@orca-so/whirlpools-client';
import { createCreateMetadataAccountV3Instruction, getMetadataAddress } from '@metaplex-foundation/mpl-token-metadata';
import fs from 'fs';

/**
 * Interface representing the local JSON structure provided
 */
interface LocalCacheData {
  pool: string;
  metadata: {
    imageCid: string;
    jsonCid: string;
    metadataUrl: string; // The URL for the Metaplex 'uri' field
  };
  bundleParams: {
    whirlpool: string;
    owner: string;
  };
}

export interface InitBundleWithMetaParams {
  wallet: { publicKey: PublicKey };
  connection: Connection;
  cachePath: string; // Path to your local JSON file
  sendTransaction: (tx: VersionedTransaction) => Promise<string>;
  addLog: (msg: string, type: 'info' | 'success' | 'error') => void;
}

export async function initBundleWithMeta(params: InitBundleWithMetaParams) {
  const { wallet, connection, cachePath, sendTransaction, addLog } = params;
  const rpc = createSolanaRpc(connection.rpcEndpoint);
  
  // 1. Load data from local JSON
  const cacheData: LocalCacheData = JSON.parse(fs.readFileSync(cachePath, 'utf-8'));
  const metadataUri = cacheData.metadata.metadataUrl;
  const whirlpoolAddress = address(cacheData.pool || cacheData.bundleParams.whirlpool);
  const ownerAddress = address(wallet.publicKey.toBase58());

  addLog(`Loaded metadata URI: ${metadataUri}`, 'info');

  try {
    // 2. Generate the Bundle Mint Signer
    const positionBundleSigner = await generateKeyPairSigner();
    const bundleMintAddr = positionBundleSigner.address;
    
    // 3. Derive Metadata PDA (Metaplex)
    const metadataPda = getMetadataAddress(bundleMintAddr);

    addLog(`Bundle Mint: ${bundleMintAddr}`, 'info');

    // 4. Build Whirlpool Initialize Bundle Instruction
    // Note: Whirlpool SDK handles the creation of the PositionBundle account
    const bundleInstruction = getInitializePositionBundleInstruction({
      owner: ownerAddress,
      positionBundle: bundleMintAddr, // In v2/v3 client, the mint and account are often linked
      funder: ownerAddress,
    });

    // 5. Build Metaplex Metadata Instruction
    const metadataInstruction = createCreateMetadataAccountV3Instruction({
      metadata: metadataPda,
      mint: bundleMintAddr,
      mintAuthority: ownerAddress,
      payer: ownerAddress,
      updateAuthority: ownerAddress,
    }, {
      isMutable: true,
      data: {
        name: "Orca Whirlpool Bundle",
        symbol: "ORCABNDL",
        uri: metadataUri, // Pulled from your local JSON
        creators: null,
        sellerFeeBasisPoints: 0,
      },
    });

    // 6. Assemble Transaction
    const { value: latestBlockhash } = await rpc.getLatestBlockhash().send();

    const message = pipe(
      createTransactionMessage({ version: 0 }),
      m => setTransactionMessageFeePayer(ownerAddress, m),
      m => setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, m),
      m => appendTransactionMessageInstruction(bundleInstruction, m),
      m => appendTransactionMessageInstruction(metadataInstruction, m)
    );

    const transaction = await compileTransaction(message);
    
    // Sign with the bundle mint keypair (required as it's a new account)
    const signedTx = await signTransaction([positionBundleSigner], transaction);

    // 7. Execute via provided sendTransaction (handles wallet signing)
    // Map to VersionedTransaction for compatibility with standard wallet adapters
    const versionedTx = new VersionedTransaction(signedTx as any);
    const signature = await sendTransaction(versionedTx);

    addLog(`Bundle + Metadata Initialized: ${signature}`, 'success');

    return {
      signature,
      bundleMint: bundleMintAddr,
      metadataPda,
      uri: metadataUri
    };

  } catch (error: any) {
    addLog(`Failed to initialize bundle: ${error.message}`, 'error');
    throw error;
  }
}