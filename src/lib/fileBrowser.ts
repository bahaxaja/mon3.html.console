// lib/module.ts
//
// Consolidated file-browser helpers (server-side) and light client helpers.
//
// This module gathers code used by the website for listing/reading/writing
// bundle, pool and keypair files so other parts of the app can reuse it.
//
// Place at: lib/module.ts (commit to the `nomodify` branch)

import fs from "fs/promises";
import path from "path";
import { getTokenSymbol } from "./loadpoolinfo"; // ensure token symbols are present when writing pools

/**
 * Paths used by the website repo (matches existing API route behavior).
 */
export const BUNDLES_DIR = path.join(process.cwd(), "public", "style");
export const BUNDLES_WORDLIST = path.join(BUNDLES_DIR, "wordlist.txt");
export const KEYPAIRS_DIR = path.join(process.cwd(), "dist", "style");
export const POOL_DIST_DIR = path.join(process.cwd(), "dist");

async function ensureDir(dir: string) {
  try {
    await fs.mkdir(dir, { recursive: true });
  } catch {}
}

export async function getWordlist(): Promise<string[]> {
  try {
    const content = await fs.readFile(BUNDLES_WORDLIST, "utf-8");
    return content.split("\n").map((w) => w.trim()).filter(Boolean);
  } catch {
    return ["bundle", "position", "whirlpool", "orca", "solana", "liquidity"];
  }
}

export async function countExistingBundles(): Promise<number> {
  try {
    await ensureDir(BUNDLES_DIR);
    const files = await fs.readdir(BUNDLES_DIR);
    return files.filter((f) => f.endsWith(".json") && f !== "wordlist.txt")
      .length;
  } catch {
    return 0;
  }
}

export function getTwoRandomWords(wordlist: string[]): string {
  const word1 = wordlist[Math.floor(Math.random() * wordlist.length)];
  const word2 = wordlist[Math.floor(Math.random() * wordlist.length)];
  return `${word1}${word2}`;
}

// --- Bundle helpers (server-side) ---

export async function listBundles(): Promise<string[]> {
  try {
    await ensureDir(BUNDLES_DIR);
    const files = await fs.readdir(BUNDLES_DIR);
    return files
      .filter((f) => f.endsWith(".json") && f !== "wordlist.txt")
      .map((f) => f.replace(/\.json$/i, ""));
  } catch {
    return [];
  }
}

export async function readBundle(mintAddress: string): Promise<any> {
  try {
    await ensureDir(BUNDLES_DIR);
    const files = await fs.readdir(BUNDLES_DIR);
    const match =
      files.find((f) => f.includes(mintAddress) && f.endsWith(".json")) ||
      `${mintAddress}.json`;
    const filePath = path.join(BUNDLES_DIR, match);
    const data = await fs.readFile(filePath, "utf-8");
    return JSON.parse(data);
  } catch {
    throw new Error("Bundle not found");
  }
}

export async function writeBundle(data: any): Promise<{
  success: boolean;
  filename?: string;
  path?: string;
  error?: string;
}> {
  try {
    await ensureDir(BUNDLES_DIR);
    if (!data.positionBundleMint) throw new Error("Missing positionBundleMint");

    const wordlist = await getWordlist();
    const bundleCount = await countExistingBundles();
    const bundleNumber = bundleCount + 1;
    const twoWords = getTwoRandomWords(wordlist);
    const filename = `${bundleNumber}${twoWords}-${data.positionBundleMint}.json`;

    const bundleData = { ...data, filename, bundleNumber, savedAt: new Date().toISOString() };
    const filePath = path.join(BUNDLES_DIR, filename);
    await fs.writeFile(filePath, JSON.stringify(bundleData, null, 2));

    return { success: true, filename, path: `public/style/${filename}` };
  } catch (err: any) {
    return { success: false, error: err?.message || String(err) };
  }
}

// --- Keypair helpers ---

export async function listKeypairs(): Promise<string[]> {
  try {
    await ensureDir(KEYPAIRS_DIR);
    const files = await fs.readdir(KEYPAIRS_DIR);
    return files.filter((f) => f.endsWith(".json")).map((f) => f.replace(/\.json$/i, ""));
  } catch {
    return [];
  }
}

export async function readKeypair(mint: string): Promise<any> {
  try {
    await ensureDir(KEYPAIRS_DIR);
    const filePath = path.join(KEYPAIRS_DIR, `${mint}.json`);
    const data = await fs.readFile(filePath, "utf-8");
    return JSON.parse(data);
  } catch {
    throw new Error("Keypair not found");
  }
}

export async function writeKeypair(obj: { mint: string; secretKey: string; [k: string]: any }) {
  try {
    await ensureDir(KEYPAIRS_DIR);
    if (!obj.mint || !obj.secretKey) throw new Error("Missing mint or secretKey");
    const keypairData = { ...obj, createdAt: new Date().toISOString() };
    const filePath = path.join(KEYPAIRS_DIR, `${obj.mint}.json`);
    await fs.writeFile(filePath, JSON.stringify(keypairData, null, 2));
    return { success: true, mint: obj.mint };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// --- Pool cache helpers ---

export function getPoolFilePath(addressStr: string) {
  return path.join(POOL_DIST_DIR, `${addressStr}.json`);
}

export async function listPools(): Promise<any[]> {
  try {
    await ensureDir(POOL_DIST_DIR);
    const files = await fs.readdir(POOL_DIST_DIR);
    const pools: any[] = [];
    for (const file of files) {
      if (file.endsWith(".json") && file.length > 10) {
        try {
          const data = await fs.readFile(path.join(POOL_DIST_DIR, file), "utf-8");
          pools.push(JSON.parse(data));
        } catch {}
      }
    }
    return pools;
  } catch {
    return [];
  }
}

export async function readPool(addressStr: string): Promise<any> {
  try {
    const filePath = getPoolFilePath(addressStr);
    const data = await fs.readFile(filePath, "utf-8");
    return JSON.parse(data);
  } catch {
    throw new Error("Pool not found");
  }
}

export async function writePool(obj: any) {
  try {
    await ensureDir(POOL_DIST_DIR);
    if (!obj.address) throw new Error("Missing address");
    // Ensure symbol information exists for both tokens when possible
    if (obj.tokenA?.mint && (!obj.tokenA?.symbol || obj.tokenA.symbol === '')) {
      try { obj.tokenA = { ...obj.tokenA, symbol: getTokenSymbol(String(obj.tokenA.mint)) }; } catch {}
    }
    if (obj.tokenB?.mint && (!obj.tokenB?.symbol || obj.tokenB.symbol === '')) {
      try { obj.tokenB = { ...obj.tokenB, symbol: getTokenSymbol(String(obj.tokenB.mint)) }; } catch {}
    }

    const filePath = getPoolFilePath(obj.address);
    const poolData = { ...obj, updatedAt: new Date().toISOString() };
    await fs.writeFile(filePath, JSON.stringify(poolData, null, 2));
    return { success: true, file: `${obj.address}.json` };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function deletePool(addressStr?: string) {
  try {
    if (addressStr) {
      const filePath = getPoolFilePath(addressStr);
      await fs.unlink(filePath);
      return { success: true, message: `${addressStr}.json deleted` };
    }

    await ensureDir(POOL_DIST_DIR);
    const files = await fs.readdir(POOL_DIST_DIR);
    for (const file of files) {
      if (file.endsWith(".json")) {
        try {
          await fs.unlink(path.join(POOL_DIST_DIR, file));
        } catch {}
      }
    }
    return { success: true, message: "All pool files deleted" };
  } catch {
    return { success: false, message: "Pool file not found or already deleted" };
  }
}

// --- Lightweight client helpers to call Next API routes used by the website ---

export async function apiListBundles(baseUrl = "") {
  const res = await fetch(`${baseUrl}/api/bundle-cache`);
  return res.ok ? res.json() : { bundles: [] };
}

export async function apiReadBundle(mint: string, baseUrl = "") {
  const res = await fetch(`${baseUrl}/api/bundle-cache?mint=${encodeURIComponent(mint)}`);
  return res.ok ? res.json() : null;
}

export async function apiListPools(baseUrl = "") {
  const res = await fetch(`${baseUrl}/api/pool-cache`);
  return res.ok ? res.json() : { pools: [] };
}

export async function apiSavePool(pool: any, baseUrl = "") {
  const res = await fetch(`${baseUrl}/api/pool-cache`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(pool),
  });
  return res.json();
}

export default {
  BUNDLES_DIR,
  KEYPAIRS_DIR,
  POOL_DIST_DIR,
  listBundles,
  readBundle,
  writeBundle,
  listKeypairs,
  readKeypair,
  writeKeypair,
  listPools,
  readPool,
  writePool,
  deletePool,
};