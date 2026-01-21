# Security Hardening Plan 2: Environment Variable Exposure (/api/env)

## Problem
`/api/env` endpoint exposes ALL environment variables (PINATA_JWT, RPC URLs, etc.) via:
- GET request returning raw `.env` file contents
- POST request allowing modification of `.env` file
- No authentication required
- Complete compromise vector

## Solution: Server-Side Config with Allowlist & Authentication

### Architecture

```
┌──────────────────────────────────┐
│  .env (Server-side only)         │
│  - NEVER exposed via API         │
│  - Loaded once at startup        │
└────────────┬─────────────────────┘
             │
             ▼
┌──────────────────────────────────┐
│  Config Manager (memory)         │
│  - Cached, read-only             │
│  - Only safe values available    │
└────────────┬─────────────────────┘
             │ Authenticated access
             ▼
┌──────────────────────────────────┐
│  New /api/config endpoint        │
│  - Returns ONLY safe config      │
│  - Requires auth                 │
│  - No secret values              │
└──────────────────────────────────┘
```

### Implementation Steps

#### Step 1: Create Config Manager
```typescript
// src/lib/configManager.ts

// Define what config is safe to expose to client
const SAFE_CONFIG = [
  'NEXT_PUBLIC_PINATA_GATEWAY',      // Public gateway URL only
  'NEXT_PUBLIC_RPC_ENDPOINT',        // Public RPC endpoint
  'NEXT_PUBLIC_BLOCKCHAIN',          // Solana mainnet/devnet
  'NEXT_PUBLIC_APP_VERSION',         // Version info
] as const;

interface ClientConfig {
  pinataGateway: string;
  rpcEndpoint: string;
  blockchain: 'mainnet' | 'devnet' | 'testnet';
  appVersion: string;
}

class ConfigManager {
  private static instance: ConfigManager;
  private config: ClientConfig;

  private constructor() {
    // Load ONLY at startup, validate values
    this.config = {
      pinataGateway: this.getEnvVar('NEXT_PUBLIC_PINATA_GATEWAY'),
      rpcEndpoint: this.getEnvVar('NEXT_PUBLIC_RPC_ENDPOINT'),
      blockchain: (this.getEnvVar('NEXT_PUBLIC_BLOCKCHAIN') || 'mainnet') as any,
      appVersion: this.getEnvVar('APP_VERSION', '1.0.0'),
    };
    
    this.validateConfig();
  }

  static getInstance(): ConfigManager {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager();
    }
    return ConfigManager.instance;
  }

  private getEnvVar(key: string, defaultValue = ''): string {
    const value = process.env[key];
    if (!value && !defaultValue) {
      throw new Error(`Required config missing: ${key}`);
    }
    return value || defaultValue;
  }

  private validateConfig() {
    // Validate URLs are valid
    try {
      new URL(this.config.pinataGateway);
      new URL(this.config.rpcEndpoint);
    } catch (e) {
      throw new Error(`Invalid config URLs: ${e}`);
    }
  }

  getClientConfig(): ClientConfig {
    // Return safe copy (read-only)
    return { ...this.config };
  }

  // Server-side access to secrets (use with caution)
  getSecret(key: 'PINATA_JWT' | 'ENCRYPTION_MASTER_KEY'): string {
    const value = process.env[key];
    if (!value) {
      throw new Error(`Secret not configured: ${key}`);
    }
    return value;
  }
}

export const configManager = ConfigManager.getInstance();
```

#### Step 2: Delete Old /api/env Route
```bash
# DELETE this file:
src/app/api/env/route.ts
```

#### Step 3: Create New Safe Config Endpoint
```typescript
// src/app/api/config/route.ts

import { NextResponse } from 'next/server';
import { configManager } from '@/lib/configManager';
import { validateRequest } from '@/lib/auth';

export async function GET(request: Request) {
  // Optional: Can be public or authenticated depending on your needs
  // For now, we'll keep it public since it contains no secrets
  
  try {
    const config = configManager.getClientConfig();
    
    // Add cache headers (safe to cache public config)
    return NextResponse.json(config, {
      headers: {
        'Cache-Control': 'public, max-age=3600', // Cache 1 hour
        'Content-Type': 'application/json',
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to load config' },
      { status: 500 }
    );
  }
}

// NO POST, DELETE, or PUT methods
```

#### Step 4: Environment Configuration
```bash
# .env.local (NEVER COMMIT THIS FILE)
# Public config (safe to expose to client)
NEXT_PUBLIC_PINATA_GATEWAY=https://gateway.pinata.cloud
NEXT_PUBLIC_RPC_ENDPOINT=https://api.mainnet-beta.solana.com
NEXT_PUBLIC_BLOCKCHAIN=mainnet
APP_VERSION=1.0.0

# Secrets (NEVER exposed to client)
PINATA_JWT=your-pinata-jwt-token
ENCRYPTION_MASTER_KEY=your-encryption-key
DATABASE_URL=postgresql://...

# .env.example (Safe to commit)
NEXT_PUBLIC_PINATA_GATEWAY=https://gateway.pinata.cloud
NEXT_PUBLIC_RPC_ENDPOINT=https://api.mainnet-beta.solana.com
NEXT_PUBLIC_BLOCKCHAIN=mainnet
APP_VERSION=1.0.0
PINATA_JWT=your-token-here
ENCRYPTION_MASTER_KEY=your-key-here
DATABASE_URL=database-url-here
```

#### Step 5: Update Client-Side Code
```typescript
// src/lib/clientConfig.ts

// Remove any calls to /api/env
// Use environment variables directly instead

export const getClientConfig = async () => {
  // Fetch from new safe endpoint
  const response = await fetch('/api/config', {
    cache: 'force-cache', // Browser will cache
  });
  
  if (!response.ok) {
    throw new Error('Failed to load config');
  }
  
  return response.json();
};

// Or even simpler - use NEXT_PUBLIC_ vars directly:
export const clientConfig = {
  pinataGateway: process.env.NEXT_PUBLIC_PINATA_GATEWAY!,
  rpcEndpoint: process.env.NEXT_PUBLIC_RPC_ENDPOINT!,
  blockchain: (process.env.NEXT_PUBLIC_BLOCKCHAIN || 'mainnet') as any,
};
```

#### Step 6: Update Pinata API Route
```typescript
// src/app/api/pinata/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { PinataSDK } from 'pinata';
import { configManager } from '@/lib/configManager';
import { validateRequest } from '@/lib/auth';

// NEW: Authenticate all Pinata requests
async function checkAuth(request: NextRequest) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return null;
  return validateRequest(token);
}

const pinata = new PinataSDK({
  // Get from secrets, NOT from environment variable exposure
  pinataJwt: configManager.getSecret('PINATA_JWT'),
  pinataGateway: configManager.getClientConfig().pinataGateway,
});

export async function POST(request: NextRequest) {
  // NEW: Require authentication
  const user = await checkAuth(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { action, jsonData, imageCid } = body;

    // Validate action against whitelist
    const allowedActions = ['uploadJson', 'createBundleMetadata'];
    if (!allowedActions.includes(action)) {
      return NextResponse.json(
        { error: 'Invalid action' },
        { status: 400 }
      );
    }

    if (action === 'uploadJson') {
      const upload = await pinata.upload.public.json(jsonData);
      const url = await pinata.gateways.public.convert(upload.cid);
      return NextResponse.json({
        success: true,
        cid: upload.cid,
        metadataUrl: url
      });
    }

    if (action === 'createBundleMetadata') {
      const gatewayUrl = configManager.getClientConfig().pinataGateway;
      const nftImage = process.env.ALBUNDY ||
        (imageCid ? `https://${gatewayUrl}/ipfs/${imageCid}` : "");

      const metaplexMetadata = {
        ...jsonData,
        image: nftImage || jsonData.image,
        properties: {
          files: nftImage ? [{ uri: nftImage, type: "image/png" }] : [],
          category: "image"
        }
      };

      const finalUpload = await pinata.upload.public.json(metaplexMetadata);
      const metadataUrl = await pinata.gateways.public.convert(finalUpload.cid);

      return NextResponse.json({
        success: true,
        cid: finalUpload.cid,
        metadataUrl
      });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    console.error('Pinata API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

#### Step 7: Startup Validation
```typescript
// src/lib/startup.ts

import { configManager } from '@/lib/configManager';

export async function validateStartup() {
  console.log('🔍 Validating startup configuration...');
  
  try {
    const config = configManager.getClientConfig();
    console.log('✅ Client config loaded');
    
    // Verify required secrets exist
    configManager.getSecret('PINATA_JWT');
    console.log('✅ Pinata JWT configured');
    
    configManager.getSecret('ENCRYPTION_MASTER_KEY');
    console.log('✅ Encryption key configured');
    
    console.log('🚀 All startup checks passed');
  } catch (error) {
    console.error('❌ Startup validation failed:', error);
    process.exit(1);
  }
}

// Call in app root
// src/app/layout.tsx or src/middleware.ts
```

### Security Benefits

✅ **No Secrets Exposed**: `/api/env` gone, no raw config endpoint  
✅ **Allowlist Approach**: Only safe values can be accessed  
✅ **Read-Only**: Config cannot be modified via API  
✅ **Authenticated Endpoints**: Pinata API requires auth  
✅ **Server-Side Secrets**: Secrets never leave server memory  
✅ **Validation**: Config validated at startup  
✅ **Caching**: Public config can be cached safely  

### Testing Checklist

- [ ] Verify `/api/env` returns 404
- [ ] Verify `/api/config` returns safe values only
- [ ] Verify no PINATA_JWT in `/api/config` response
- [ ] Verify Pinata endpoint requires auth token
- [ ] Test with invalid config values at startup
- [ ] Verify config is immutable

### Monitoring

```typescript
// Alert on:
- Attempts to access removed /api/env endpoint
- Attempts to POST/DELETE to /api/config
- Invalid PINATA_JWT failures
- Config validation failures at startup
```

### Migration Path

1. Create new ConfigManager
2. Create new /api/config endpoint
3. Update client to use /api/config
4. Add auth to Pinata endpoint
5. Remove old /api/env endpoint
6. Update documentation
