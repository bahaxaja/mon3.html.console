import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

const KEYPAIRS_DIR = path.join(process.cwd(), "dist", "style");

async function ensureDir() {
  try {
    await fs.mkdir(KEYPAIRS_DIR, { recursive: true });
  } catch {}
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const mint = searchParams.get("mint");
  
  if (!mint) {
    try {
      await ensureDir();
      const files = await fs.readdir(KEYPAIRS_DIR);
      const keypairs = files.filter(f => f.endsWith('.json')).map(f => f.replace('.json', ''));
      return NextResponse.json({ keypairs });
    } catch {
      return NextResponse.json({ keypairs: [] });
    }
  }
  
  try {
    const filePath = path.join(KEYPAIRS_DIR, `${mint}.json`);
    const data = await fs.readFile(filePath, "utf-8");
    return NextResponse.json(JSON.parse(data));
  } catch {
    return NextResponse.json({ error: "Keypair not found" }, { status: 404 });
  }
}

export async function POST(request: Request) {
  try {
    await ensureDir();
    const data = await request.json();
    
    if (!data.mint || !data.secretKey) {
      return NextResponse.json({ error: "Missing mint or secretKey" }, { status: 400 });
    }
    
    const keypairData = {
      mint: data.mint,
      secretKey: data.secretKey,
      createdAt: new Date().toISOString(),
      ...data
    };
    
    const filePath = path.join(KEYPAIRS_DIR, `${data.mint}.json`);
    await fs.writeFile(filePath, JSON.stringify(keypairData, null, 2));
    
    return NextResponse.json({ success: true, mint: data.mint });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
