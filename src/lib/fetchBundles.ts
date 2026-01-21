//AGENT RULE:
//ALWAYS READ THE .nomodify FILE
//BEFORE EDITING AND DO NOT EDIT
//ANY FILES LISTED IN .nomodify

import { fetchPositionsForOwner } from "@orca-so/whirlpools";  
import { fetchPositionBundle, getBundledPositionAddress, fetchPosition } from "@orca-so/whirlpools-client";
import { Address, Rpc } from "@solana/kit";

export async function getPositionBundle(rpc: Rpc<any>, nftAddress: Address) {
  const bundle = await fetchPositionBundle(rpc, nftAddress);
  
  if (!bundle || !bundle.data) {
    throw new Error("Failed to fetch position bundle or bundle data is empty");
  }
  
  const bitmap = bundle.data.positionBitmap || new Uint8Array(32);
  let positionCount = 0;
  const occupiedIndices: number[] = [];
  
  for (let byteIndex = 0; byteIndex < bitmap.length; byteIndex++) {
    const byte = bitmap[byteIndex];
    for (let bitIndex = 0; bitIndex < 8; bitIndex++) {
      if ((byte >> bitIndex) & 1) {
        occupiedIndices.push(byteIndex * 8 + bitIndex);
        positionCount++;
      }
    }
  }

  let poolAddress: string | null = null;
  
    if (positionCount > 0 && occupiedIndices.length > 0) {
      try {
        const firstIndex = occupiedIndices[0];
        console.log(`Fetching pool info from bundled position at index ${firstIndex}...`);
        
        if (!bundle.data.positionBundleMint) {
          throw new Error("Bundle data missing positionBundleMint");
        }

        const bundledPositionPda = await getBundledPositionAddress(
          bundle.data.positionBundleMint,
          firstIndex
        );
      
      const bundledPositionAddress = Array.isArray(bundledPositionPda) 
        ? bundledPositionPda[0] 
        : bundledPositionPda;
      
      const position = await fetchPosition(rpc, bundledPositionAddress);
      if (position && position.data?.whirlpool) {
        poolAddress = position.data.whirlpool.toString();
      }
    } catch (e) {
      console.error('Failed to fetch bundled position:', e);
    }
  }

  return { bundle, poolAddress, positionCount, occupiedIndices };
}

export async function fetchBundlesForOwner(rpc: Rpc<any>, owner: Address) {
  const positions = await fetchPositionsForOwner(rpc, owner);
  const bundles = positions.filter((p: any) => p.isPositionBundle);
  return bundles;
}
