import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

const DIST_DIR = path.join(process.cwd(), "dist");

async function ensureDistDir() {
  try {
    await fs.mkdir(DIST_DIR, { recursive: true });
  } catch {}
}

function getPoolFilePath(address: string) {
  return path.join(DIST_DIR, `${address}.json`);
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const address = searchParams.get('address');
    
    if (address) {
      const filePath = getPoolFilePath(address);
      const data = await fs.readFile(filePath, "utf-8");
      return NextResponse.json(JSON.parse(data));
    }
    
    await ensureDistDir();
    const files = await fs.readdir(DIST_DIR);
    const pools: any[] = [];
    for (const file of files) {
      if (file.endsWith('.json') && file.length > 10) {
        try {
          const data = await fs.readFile(path.join(DIST_DIR, file), "utf-8");
          pools.push(JSON.parse(data));
        } catch {}
      }
    }
    return NextResponse.json({ pools, bundles: [] });
  } catch {
    return NextResponse.json({ pools: [], bundles: [] });
  }
}

export async function POST(request: Request) {
  try {
    await ensureDistDir();
    const incomingData = await request.json();
    
    if (incomingData.address) {
      const filePath = getPoolFilePath(incomingData.address);
      const poolData = { ...incomingData, updatedAt: new Date().toISOString() };
      await fs.writeFile(filePath, JSON.stringify(poolData, null, 2));
      return NextResponse.json({ 
        success: true, 
        file: `${incomingData.address}.json`,
        poolCount: 1
      });
    }
    
    return NextResponse.json({ error: 'No pool address provided' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const address = searchParams.get('address');
    
    if (address) {
      const filePath = getPoolFilePath(address);
      await fs.unlink(filePath);
      return NextResponse.json({ success: true, message: `${address}.json deleted` });
    }
    
    await ensureDistDir();
    const files = await fs.readdir(DIST_DIR);
    for (const file of files) {
      if (file.endsWith('.json')) {
        try {
          await fs.unlink(path.join(DIST_DIR, file));
        } catch {}
      }
    }
    return NextResponse.json({ success: true, message: 'All pool files deleted' });
  } catch {
    return NextResponse.json({ success: true, message: 'Pool file not found or already deleted' });
  }
}
