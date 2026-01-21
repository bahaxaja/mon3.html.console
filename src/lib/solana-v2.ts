//AGENT RULE:
//ALWAYS READ THE .nomodify FILE
//BEFORE EDITING AND DO NOT EDIT
//ANY FILES LISTED IN .nomodify

import { 
  createSolanaRpc, 
  address, 
  lamports, 
  requestAirdropIfRequired,
  getSignatureFromTransaction,
  Rpc,
  SolanaRpcApi,
  Address
} from '@solana/kit';

export const getRpc = (url: string) => createSolanaRpc(url);

export async function airdrop(rpc: Rpc<SolanaRpcApi>, walletAddress: string, amount: number) {
  const userAddress = address(walletAddress);
  const signature = await requestAirdropIfRequired({
    rpc,
    address: userAddress,
    lamports: lamports(BigInt(amount * 1_000_000_000)),
    commitment: 'confirmed',
  });
  return signature;
}

export async function getBalance(rpc: Rpc<SolanaRpcApi>, walletAddress: string) {
  const result = await rpc.getBalance(address(walletAddress)).send();
  return Number(result.value) / 1_000_000_000;
}
