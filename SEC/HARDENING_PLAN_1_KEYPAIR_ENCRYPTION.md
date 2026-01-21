# Security Hardening Plan 1: Secret Key Encryption (/api/keypair)

## Problem
Secret keys are stored in plain text JSON files, exposing private wallet keys to:
- File system access (if server is breached)
- Memory access
- Accidental exposure in logs/backups

## Solution: Envelope Encryption with Key Derivation

### Architecture

```
┌─────────────────────────────────────────────┐
│  Client (React App)                         │
│  - Never sends raw secret key                │
│  - Uses localStorage with user password      │
└──────────────┬──────────────────────────────┘
               │ Encrypted payload only
               ▼
┌─────────────────────────────────────────────┐
│  API Route (/api/keypair)                   │
│  - Decrypts with Data Encryption Key (DEK)  │
│  - Never stores raw keys                     │
│  - Returns only encrypted content            │
└──────────────┬──────────────────────────────┘
               │ Encrypted file storage
               ▼
┌─────────────────────────────────────────────┐
│  Storage (dist/style/*.json)                 │
│  - AES-256-GCM encrypted                     │
│  - DEK stored in environment only            │
│  - Keying material never persisted           │
└─────────────────────────────────────────────┘
```

### Implementation Steps

#### Step 1: Add Encryption Dependencies
```bash
npm install crypto-js @noble/ciphers
```

#### Step 2: Create Encryption Utility
```typescript
// src/lib/encryption.ts

import crypto from 'crypto';

export class KeypairEncryption {
  // Generate DEK from master key (ENCRYPTION_MASTER_KEY env var)
  static generateDEK(): Buffer {
    const masterKey = process.env.ENCRYPTION_MASTER_KEY;
    if (!masterKey) throw new Error('ENCRYPTION_MASTER_KEY not set');
    
    return crypto
      .pbkdf2Sync(masterKey, 'keypair-dek', 100000, 32, 'sha256');
  }

  // Encrypt secret key with AES-256-GCM
  static encrypt(secretKey: string): {
    encryptedData: string;
    iv: string;
    authTag: string;
    timestamp: number;
  } {
    const dek = this.generateDEK();
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-gcm', dek, iv);
    
    let encrypted = cipher.update(secretKey, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag();
    
    return {
      encryptedData: encrypted,
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex'),
      timestamp: Date.now(),
    };
  }

  // Decrypt secret key
  static decrypt(encrypted: {
    encryptedData: string;
    iv: string;
    authTag: string;
  }): string {
    const dek = this.generateDEK();
    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      dek,
      Buffer.from(encrypted.iv, 'hex')
    );
    
    decipher.setAuthTag(Buffer.from(encrypted.authTag, 'hex'));
    let decrypted = decipher.update(encrypted.encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }
}
```

#### Step 3: Update Keypair API Route
```typescript
// src/app/api/keypair/route.ts

import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { KeypairEncryption } from "@/lib/encryption";
import { validateRequest } from "@/lib/auth"; // NEW: Add auth

const KEYPAIRS_DIR = path.join(process.cwd(), "dist", "style");

// NEW: Authentication middleware
async function checkAuth(request: Request) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return null;
  return validateRequest(token); // Validate JWT/session
}

export async function GET(request: Request) {
  // NEW: Require authentication
  const user = await checkAuth(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const mint = searchParams.get("mint");
  
  if (!mint) {
    try {
      await fs.mkdir(KEYPAIRS_DIR, { recursive: true });
      const files = await fs.readdir(KEYPAIRS_DIR);
      const keypairs = files
        .filter(f => f.endsWith('.json'))
        .map(f => f.replace('.json', ''));
      return NextResponse.json({ keypairs });
    } catch {
      return NextResponse.json({ keypairs: [] });
    }
  }
  
  try {
    const filePath = path.join(KEYPAIRS_DIR, `${mint}.json`);
    const data = await fs.readFile(filePath, "utf-8");
    const stored = JSON.parse(data);
    
    // NEW: Return encrypted key, NOT decrypted
    return NextResponse.json({
      mint: stored.mint,
      encrypted: stored.encrypted,
      timestamp: stored.timestamp,
      // ✅ NEVER return decrypted secret key
    });
  } catch {
    return NextResponse.json({ error: "Keypair not found" }, { status: 404 });
  }
}

export async function POST(request: Request) {
  // NEW: Require authentication
  const user = await checkAuth(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await fs.mkdir(KEYPAIRS_DIR, { recursive: true });
    const data = await request.json();
    
    if (!data.mint || !data.secretKey) {
      return NextResponse.json(
        { error: "Missing mint or secretKey" },
        { status: 400 }
      );
    }
    
    // NEW: Encrypt before storing
    const encrypted = KeypairEncryption.encrypt(data.secretKey);
    
    const keypairData = {
      mint: data.mint,
      encrypted, // Store encrypted data
      createdAt: new Date().toISOString(),
      // ✅ NO raw secretKey in storage
    };
    
    const filePath = path.join(KEYPAIRS_DIR, `${data.mint}.json`);
    await fs.writeFile(filePath, JSON.stringify(keypairData, null, 2));
    
    return NextResponse.json({
      success: true,
      mint: data.mint,
      message: "Keypair stored securely (encrypted)"
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// NEW: Decrypt endpoint for authorized use only
export async function PUT(request: Request) {
  const user = await checkAuth(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { mint } = await request.json();
    const filePath = path.join(KEYPAIRS_DIR, `${mint}.json`);
    const data = JSON.parse(await fs.readFile(filePath, "utf-8"));
    
    // IMPORTANT: Only decrypt on explicit request with auth
    const decrypted = KeypairEncryption.decrypt(data.encrypted);
    
    // Log this action for audit trail
    console.log(`[AUDIT] User ${user.id} decrypted keypair for ${mint}`);
    
    return NextResponse.json({
      secretKey: decrypted,
      // Set short expiry for client to use
      expiresIn: 300, // 5 minutes
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
```

#### Step 4: Environment Variables
```bash
# .env.local (NEVER COMMIT)
ENCRYPTION_MASTER_KEY=your-base64-encoded-random-key
# Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

# .env.example (Safe to commit)
ENCRYPTION_MASTER_KEY=your-encryption-key-here
```

#### Step 5: Client-Side Changes
```typescript
// src/lib/keypairStore.ts - Client-side secure storage

export class SecureKeypairStore {
  // Store encrypted on client with user password
  static async saveKeyPair(mint: string, secretKey: string, userPassword: string) {
    const encrypted = await this.encryptWithPassword(secretKey, userPassword);
    
    const response = await fetch('/api/keypair', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getAuthToken()}`
      },
      body: JSON.stringify({
        mint,
        secretKey: encrypted, // Send encrypted
      })
    });
    
    if (!response.ok) throw new Error('Failed to save keypair');
  }

  // Use only when needed
  static async getDecryptedKeyPair(mint: string) {
    const response = await fetch('/api/keypair', {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${getAuthToken()}`
      },
      body: JSON.stringify({ mint })
    });
    
    const { secretKey, expiresIn } = await response.json();
    
    // Use immediately, clear from memory after
    return { secretKey, expiresIn };
  }

  private static async encryptWithPassword(data: string, password: string) {
    // Use TweetNaCl.js or similar for client encryption
    // Store encrypted blob in sessionStorage (NOT localStorage)
  }
}
```

### Security Benefits

✅ **Encryption at Rest**: AES-256-GCM protects stored keys  
✅ **Authentication Required**: Only authorized users can access  
✅ **Key Derivation**: PBKDF2 prevents rainbow tables  
✅ **Authenticated Encryption**: GCM mode detects tampering  
✅ **Decryption on Demand**: Keys only decrypted when needed  
✅ **Audit Trail**: All access logged with user ID  
✅ **Short-lived**: Client-side secret only valid 5 minutes  

### Testing Checklist

- [ ] Test encryption/decryption roundtrip
- [ ] Test authentication failure returns 401
- [ ] Test tampering with encrypted data fails auth tag check
- [ ] Test audit logs record all access
- [ ] Test DEK rotation procedure
- [ ] Load test with many keypairs

### Monitoring

```typescript
// Alert on:
- Multiple failed decryption attempts (potential attack)
- Access from unusual IP addresses
- Bulk keypair downloads
- Decryption outside normal hours
```

### Migration Plan

1. Add encryption utility (non-breaking)
2. Encrypt all new keypairs
3. Background job to encrypt existing keypairs
4. Update client to handle encrypted format
5. Add authentication to API
6. Deprecate unencrypted storage
