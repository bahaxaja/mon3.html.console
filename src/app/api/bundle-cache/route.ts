import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

const BUNDLES_DIR = path.join(process.cwd(), "public", "style");
const WORDLIST_PATH = path.join(process.cwd(), "public", "style", "wordlist.txt");

async function ensureDir() {
  try {
    await fs.mkdir(BUNDLES_DIR, { recursive: true });
  } catch {}
}

async function getWordlist(): Promise<string[]> {
  try {
    const content = await fs.readFile(WORDLIST_PATH, "utf-8");
    return content.split("\n").map(w => w.trim()).filter(w => w.length > 0);
  } catch {
    return ["bundle", "position", "whirlpool", "orca", "solana", "liquidity"];
  }
}

async function countExistingBundles(): Promise<number> {
  try {
    const files = await fs.readdir(BUNDLES_DIR);
    return files.filter(f => f.endsWith('.json') && f !== 'wordlist.txt').length;
  } catch {
    return 0;
  }
}

function getTwoRandomWords(wordlist: string[]): string {
  const word1 = wordlist[Math.floor(Math.random() * wordlist.length)];
  const word2 = wordlist[Math.floor(Math.random() * wordlist.length)];
  return `${word1}${word2}`;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const mintAddress = searchParams.get("mint");
  
  if (!mintAddress) {
    try {
      await ensureDir();
      const files = await fs.readdir(BUNDLES_DIR);
      const bundles = files
        .filter(f => f.endsWith('.json') && f !== 'wordlist.txt')
        .map(f => f.replace('.json', ''));
      return NextResponse.json({ bundles });
    } catch {
      return NextResponse.json({ bundles: [] });
    }
  }
  
  try {
    await ensureDir();
    const files = await fs.readdir(BUNDLES_DIR);
    const matchingFile = files.find(f => f.includes(mintAddress) && f.endsWith('.json'));
    
    if (matchingFile) {
      const filePath = path.join(BUNDLES_DIR, matchingFile);
      const data = await fs.readFile(filePath, "utf-8");
      return NextResponse.json(JSON.parse(data));
    }
    
    const exactPath = path.join(BUNDLES_DIR, `${mintAddress}.json`);
    const data = await fs.readFile(exactPath, "utf-8");
    return NextResponse.json(JSON.parse(data));
  } catch {
    return NextResponse.json({ error: "Bundle not found" }, { status: 404 });
  }
}

export async function POST(request: Request) {
  try {
    await ensureDir();
    const data = await request.json();
    
    if (!data.positionBundleMint) {
      return NextResponse.json({ error: "Missing positionBundleMint" }, { status: 400 });
    }
    
    const wordlist = await getWordlist();
    const bundleCount = await countExistingBundles();
    const bundleNumber = bundleCount + 1;
    const twoWords = getTwoRandomWords(wordlist);
    
    const filename = `${bundleNumber}${twoWords}-${data.positionBundleMint}.json`;
    
    const bundleData = {
      ...data,
      filename,
      bundleNumber,
      savedAt: new Date().toISOString()
    };
    
    const filePath = path.join(BUNDLES_DIR, filename);
    await fs.writeFile(filePath, JSON.stringify(bundleData, null, 2));
    
    return NextResponse.json({ 
      success: true, 
      mint: data.positionBundleMint,
      filename,
      bundleNumber,
      path: `public/style/${filename}`
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
