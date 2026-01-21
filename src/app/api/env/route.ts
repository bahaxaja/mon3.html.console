import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const ENV_PATH = path.join(process.cwd(), '.env');

export async function GET() {
  try {
    if (!fs.existsSync(ENV_PATH)) {
      return NextResponse.json({ env: '' });
    }
    const envContent = fs.readFileSync(ENV_PATH, 'utf-8');
    return NextResponse.json({ env: envContent });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to read .env' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { env } = await req.json();
    fs.writeFileSync(ENV_PATH, env, 'utf-8');
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to save .env' }, { status: 500 });
  }
}
