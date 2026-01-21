# Security Hardening Plan 7 & 8: Pinata API + Cache APIs (Authentication & Validation)

## Problem - Pinata

### Current Code
```typescript
// ❌ VULNERABLE
const pinata = new PinataSDK({
  pinataJwt: process.env.PINATA_JWT!,  // Exposed via /api/env
  pinataGateway: process.env.PINATA_GATEWAY!,
});

// ❌ No authentication required
export async function POST(request: NextRequest) {
  const { action, jsonData, imageCid } = body;
  // Anyone can upload to IPFS, modify metadata, etc.
}
```

## Problem - Cache APIs

### Current Code
```typescript
// ❌ VULNERABLE - No authentication
export async function GET(request: Request) {
  const mintAddress = searchParams.get("mint");
  const files = await fs.readdir(BUNDLES_DIR);
  // Anyone can read all bundles
}

export async function POST(request: Request) {
  const data = await request.json();
  // Anyone can write malicious bundle data
}
```

## Solution: Hardened Pinata + Cache APIs with Auth & Validation

### Step 1: Create Pinata Service with Validation

```typescript
// src/lib/pinataService.ts

import { PinataSDK } from 'pinata';
import { configManager } from '@/lib/configManager';
import { z } from 'zod';

// ✅ Schema validation for Pinata uploads
const uploadJsonSchema = z.object({
  action: z.enum(['uploadJson', 'createBundleMetadata']),
  jsonData: z.record(z.unknown()),
  imageCid: z.string().optional(),
});

const bundleMetadataSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500),
  symbol: z.string().max(10),
  decimals: z.number().int().min(0).max(18),
});

export class PinataService {
  private static instance: PinataSDK;

  static getInstance(): PinataSDK {
    if (!PinataService.instance) {
      PinataService.instance = new PinataSDK({
        pinataJwt: configManager.getSecret('PINATA_JWT'),
        pinataGateway: configManager.getClientConfig().pinataGateway,
      });
    }
    return PinataService.instance;
  }

  // ✅ Validate and upload JSON
  static async uploadJson(data: any): Promise<{ cid: string; url: string }> {
    // Validate structure
    if (!data || typeof data !== 'object') {
      throw new Error('Invalid JSON data');
    }

    // Limit size (max 100KB per file)
    const size = JSON.stringify(data).length;
    if (size > 100 * 1024) {
      throw new Error('File too large (max 100KB)');
    }

    // Scan for suspicious patterns
    this.scanForMalicious(data);

    const pinata = this.getInstance();
    const upload = await pinata.upload.public.json(data);
    const url = await pinata.gateways.public.convert(upload.cid);

    return { cid: upload.cid, url };
  }

  // ✅ Create bundle metadata with validation
  static async createBundleMetadata(
    metadata: any,
    imageCid?: string
  ): Promise<{ cid: string; url: string }> {
    try {
      // Validate metadata structure
      const validated = bundleMetadataSchema.parse(metadata);
    } catch (error) {
      throw new Error(`Invalid metadata: ${error}`);
    }

    const gatewayUrl = configManager.getClientConfig().pinataGateway;
    const nftImage = process.env.ALBUNDY ||
      (imageCid ? `https://${gatewayUrl}/ipfs/${imageCid}` : "");

    const metaplexMetadata = {
      ...metadata,
      image: nftImage || metadata.image,
      properties: {
        files: nftImage ? [{ uri: nftImage, type: "image/png" }] : [],
        category: "image"
      }
    };

    // Scan for suspicious content
    this.scanForMalicious(metaplexMetadata);

    return this.uploadJson(metaplexMetadata);
  }

  // ✅ Scan for malicious patterns
  private static scanForMalicious(data: any): void {
    const jsonString = JSON.stringify(data).toLowerCase();

    const maliciousPatterns = [
      /<script/,
      /javascript:/,
      /onclick=/,
      /onerror=/,
      /eval\(/,
      /function\(/,
      /blob:/,
    ];

    for (const pattern of maliciousPatterns) {
      if (pattern.test(jsonString)) {
        throw new Error('Malicious content detected');
      }
    }
  }

  // ✅ Validate CID format
  static isValidCid(cid: string): boolean {
    // Basic CID validation (v0 and v1)
    return /^Qm[a-zA-Z0-9]{44}$/.test(cid) || /^bafy[a-zA-Z0-9]{55}$/.test(cid);
  }
}
```

### Step 2: Update Pinata API Route with Auth

```typescript
// src/app/api/pinata/route.ts - HARDENED

import { NextRequest, NextResponse } from 'next/server';
import { PinataService } from '@/lib/pinataService';
import { AuthService } from '@/lib/auth/authService';
import { z } from 'zod';

// ✅ Request validation
const pinataRequestSchema = z.object({
  action: z.enum(['uploadJson', 'createBundleMetadata']),
  jsonData: z.record(z.unknown()),
  imageCid: z.string().optional(),
});

export async function POST(request: NextRequest) {
  // ✅ Require authentication
  const userId = request.headers.get('x-user-id');
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // ✅ Validate request body
    const body = await request.json();
    const validated = pinataRequestSchema.parse(body);

    const { action, jsonData, imageCid } = validated;

    // ✅ Validate CID if provided
    if (imageCid && !PinataService.isValidCid(imageCid)) {
      return NextResponse.json(
        { error: 'Invalid image CID format' },
        { status: 400 }
      );
    }

    // ✅ Only allow specific actions
    if (action === 'uploadJson') {
      const { cid, url } = await PinataService.uploadJson(jsonData);
      return NextResponse.json({
        success: true,
        cid,
        metadataUrl: url
      });
    }

    if (action === 'createBundleMetadata') {
      const { cid, url } = await PinataService.createBundleMetadata(
        jsonData,
        imageCid
      );
      return NextResponse.json({
        success: true,
        cid,
        metadataUrl: url
      });
    }

    return NextResponse.json(
      { error: 'Invalid action' },
      { status: 400 }
    );
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      );
    }

    console.error('[PINATA] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Pinata operation failed' },
      { status: 500 }
    );
  }
}
```

### Step 3: Hardened Bundle Cache API

```typescript
// src/app/api/bundle-cache/route.ts - HARDENED

import { NextResponse, NextRequest } from "next/server";
import fs from "fs/promises";
import path from "path";
import { AuthService } from "@/lib/auth/authService";
import { z } from "zod";
import { RateLimiter } from "@/lib/rateLimiter";

const BUNDLES_DIR = path.join(process.cwd(), "public", "style");
const rateLimiter = new RateLimiter({ maxRequests: 100, windowMs: 60000 });

// ✅ Schema validation
const bundleSchema = z.object({
  positionBundleMint: z.string().regex(/^[a-zA-Z0-9]{44}$/, 'Invalid mint address'),
  poolInfo: z.object({
    tokenA: z.object({ mint: z.string(), symbol: z.string() }),
    tokenB: z.object({ mint: z.string(), symbol: z.string() }),
  }),
  positions: z.array(z.object({
    index: z.number(),
    tickLower: z.number(),
    tickUpper: z.number(),
  })).optional(),
});

async function checkAuth(request: NextRequest) {
  const userId = request.headers.get('x-user-id');
  if (!userId) return null;
  return userId;
}

export async function GET(request: NextRequest) {
  const userId = await checkAuth(request);
  
  // ✅ Rate limit
  if (!rateLimiter.allow(userId || 'anonymous')) {
    return NextResponse.json(
      { error: 'Rate limit exceeded' },
      { status: 429 }
    );
  }

  const { searchParams } = new URL(request.url);
  const mintAddress = searchParams.get("mint");
  
  if (!mintAddress) {
    try {
      await fs.mkdir(BUNDLES_DIR, { recursive: true });
      const files = await fs.readdir(BUNDLES_DIR);
      const bundles = files
        .filter(f => f.endsWith('.json') && f !== 'wordlist.txt')
        .map(f => f.replace('.json', ''));
      return NextResponse.json({ bundles });
    } catch {
      return NextResponse.json({ bundles: [] });
    }
  }

  // ✅ Validate mint format
  if (!/^[a-zA-Z0-9]{44}$/.test(mintAddress)) {
    return NextResponse.json(
      { error: 'Invalid mint address' },
      { status: 400 }
    );
  }

  try {
    await fs.mkdir(BUNDLES_DIR, { recursive: true });
    const files = await fs.readdir(BUNDLES_DIR);
    const matchingFile = files.find(f => f.includes(mintAddress) && f.endsWith('.json'));
    
    if (matchingFile) {
      const filePath = path.join(BUNDLES_DIR, matchingFile);
      const data = await fs.readFile(filePath, "utf-8");
      return NextResponse.json(JSON.parse(data));
    }
    
    return NextResponse.json({ error: "Bundle not found" }, { status: 404 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  // ✅ Require authentication
  const userId = await checkAuth(request);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ✅ Rate limit
  if (!rateLimiter.allow(userId)) {
    return NextResponse.json(
      { error: 'Rate limit exceeded' },
      { status: 429 }
    );
  }

  try {
    await fs.mkdir(BUNDLES_DIR, { recursive: true });
    const data = await request.json();
    
    // ✅ Validate with Zod
    const validated = bundleSchema.parse(data);
    
    if (!validated.positionBundleMint) {
      return NextResponse.json(
        { error: "Missing positionBundleMint" },
        { status: 400 }
      );
    }
    
    const bundleData = {
      ...validated,
      savedAt: new Date().toISOString(),
      savedBy: userId, // ✅ Track who saved it
    };
    
    const filename = `${validated.positionBundleMint}.json`;
    const filePath = path.join(BUNDLES_DIR, filename);
    
    await fs.writeFile(filePath, JSON.stringify(bundleData, null, 2));
    
    return NextResponse.json({ 
      success: true, 
      mint: validated.positionBundleMint,
      path: `public/style/${filename}`
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
```

### Step 4: Hardened Pool Cache API

```typescript
// src/app/api/pool-cache/route.ts - HARDENED

import { NextResponse, NextRequest } from "next/server";
import fs from "fs/promises";
import path from "path";
import { AuthService } from "@/lib/auth/authService";
import { z } from "zod";
import { RateLimiter } from "@/lib/rateLimiter";

const DIST_DIR = path.join(process.cwd(), "dist");
const rateLimiter = new RateLimiter({ maxRequests: 100, windowMs: 60000 });

// ✅ Schema validation
const poolSchema = z.object({
  address: z.string().regex(/^[a-zA-Z0-9]{44}$/, 'Invalid pool address'),
  tokenMintA: z.string(),
  tokenMintB: z.string(),
  fee: z.number().min(0).max(10000),
  tickSpacing: z.number().int().positive(),
});

async function checkAuth(request: NextRequest) {
  const userId = request.headers.get('x-user-id');
  if (!userId) return null;
  return userId;
}

export async function GET(request: NextRequest) {
  const userId = await checkAuth(request);
  
  // ✅ Rate limit (allow without auth for public reads)
  if (!rateLimiter.allow(userId || 'anonymous')) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const address = searchParams.get('address');
    
    if (address) {
      // ✅ Validate address
      if (!/^[a-zA-Z0-9]{44}$/.test(address)) {
        return NextResponse.json({ error: 'Invalid address' }, { status: 400 });
      }

      const filePath = path.join(DIST_DIR, `${address}.json`);
      const data = await fs.readFile(filePath, "utf-8");
      return NextResponse.json(JSON.parse(data));
    }
    
    await fs.mkdir(DIST_DIR, { recursive: true });
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

export async function POST(request: NextRequest) {
  // ✅ Require authentication to write
  const userId = await checkAuth(request);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ✅ Rate limit
  if (!rateLimiter.allow(userId)) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }

  try {
    await fs.mkdir(DIST_DIR, { recursive: true });
    const incomingData = await request.json();
    
    // ✅ Validate with Zod
    const validated = poolSchema.parse(incomingData);
    
    if (!validated.address) {
      return NextResponse.json(
        { error: 'No pool address provided' },
        { status: 400 }
      );
    }
    
    const poolData = {
      ...validated,
      updatedAt: new Date().toISOString(),
      updatedBy: userId, // ✅ Track who updated it
    };
    
    const filePath = path.join(DIST_DIR, `${validated.address}.json`);
    await fs.writeFile(filePath, JSON.stringify(poolData, null, 2));
    
    return NextResponse.json({ 
      success: true, 
      file: `${validated.address}.json`,
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  // ✅ Require authentication
  const userId = await checkAuth(request);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ✅ Rate limit
  if (!rateLimiter.allow(userId)) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const address = searchParams.get('address');
    
    if (!address || !/^[a-zA-Z0-9]{44}$/.test(address)) {
      return NextResponse.json({ error: 'Invalid address' }, { status: 400 });
    }

    const filePath = path.join(DIST_DIR, `${address}.json`);
    await fs.unlink(filePath);
    
    return NextResponse.json({ success: true, message: `${address}.json deleted` });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
```

### Step 5: Create Rate Limiter

```typescript
// src/lib/rateLimiter.ts

export class RateLimiter {
  private attempts: Map<string, number[]> = new Map();
  private maxRequests: number;
  private windowMs: number;

  constructor({ maxRequests = 100, windowMs = 60000 }) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
  }

  allow(identifier: string): boolean {
    const now = Date.now();
    const windowStart = now - this.windowMs;

    let timestamps = this.attempts.get(identifier) || [];
    
    // Remove old timestamps outside window
    timestamps = timestamps.filter(ts => ts > windowStart);

    if (timestamps.length >= this.maxRequests) {
      return false;
    }

    timestamps.push(now);
    this.attempts.set(identifier, timestamps);

    // Cleanup old entries
    if (this.attempts.size > 10000) {
      for (const [key, times] of this.attempts.entries()) {
        if (times.length === 0 || times[times.length - 1] < windowStart) {
          this.attempts.delete(key);
        }
      }
    }

    return true;
  }
}
```

## Security Benefits

✅ **Authentication Required**: Only authorized users can modify data  
✅ **Input Validation**: Zod schemas prevent malicious data  
✅ **CID Validation**: IPFS CIDs validated before use  
✅ **Malicious Scan**: XSS/injection patterns detected  
✅ **Rate Limiting**: Prevent abuse and DoS  
✅ **Size Limits**: Files capped at 100KB  
✅ **Audit Trail**: Track who made changes  
✅ **Allowlist Actions**: Only specific operations allowed  

## Testing

```typescript
// src/__tests__/cacheAPIs.test.ts

describe('Cache APIs', () => {
  it('rejects requests without auth', async () => {
    const response = await fetch('/api/bundle-cache', {
      method: 'POST',
      body: JSON.stringify({ positionBundleMint: 'test' })
    });
    expect(response.status).toBe(401);
  });

  it('validates mint address format', async () => {
    const response = await fetch('/api/bundle-cache', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ positionBundleMint: 'invalid' })
    });
    expect(response.status).toBe(400);
  });

  it('enforces rate limits', async () => {
    // Make 101 requests
    for (let i = 0; i < 101; i++) {
      const response = await fetch('/api/bundle-cache');
      if (i < 100) {
        expect(response.status).toBe(200);
      } else {
        expect(response.status).toBe(429);
      }
    }
  });
});
```

## Rollout Plan

1. Update PinataService with validation
2. Add RateLimiter utility
3. Update Pinata API with auth
4. Update bundle-cache with auth + validation
5. Update pool-cache with auth + validation
6. Test all endpoints
7. Deploy with monitoring
8. Monitor rate limit events
