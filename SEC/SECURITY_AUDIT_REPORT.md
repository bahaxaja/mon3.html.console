# Security Audit Report
**Date:** 2026-01-18  
**Status:** CRITICAL VULNERABILITIES FOUND

---

## Executive Summary
This codebase contains **multiple critical security vulnerabilities** related to:
- Exposed secret key storage and transmission
- Unprotected API endpoints exposing sensitive data
- Environment variable exposure via API
- Missing request validation and authentication
- Potential data exfiltration risks

---

## 🔴 CRITICAL FINDINGS

### 1. **CRITICAL: Secret Key Storage & API Exposure (keypair/route.ts)**

**Location:** `src/app/api/keypair/route.ts`

**Vulnerability:**
- Stores raw secret keys in JSON files in `dist/style/` directory
- Secret keys are stored unencrypted
- POST endpoint accepts and stores secret keys without authentication
- GET endpoint exposes all stored secret keys

**Code:**
```typescript
export async function POST(request: Request) {
  const data = await request.json();
  if (!data.mint || !data.secretKey) {
    return NextResponse.json({ error: "Missing mint or secretKey" }, { status: 400 });
  }
  const keypairData = {
    mint: data.mint,
    secretKey: data.secretKey,  // ⚠️ STORED UNENCRYPTED
    ...data
  };
  const filePath = path.join(KEYPAIRS_DIR, `${data.mint}.json`);
  await fs.writeFile(filePath, JSON.stringify(keypairData, null, 2));
}
```

**Risk:** Wallet private keys exposed to file system and network access

**Recommendation:** REMOVE THIS ENDPOINT. Never store secret keys server-side.

---

### 2. **CRITICAL: Environment Variables Exposed via API (env/route.ts)**

**Location:** `src/app/api/env/route.ts`

**Vulnerability:**
- GET endpoint returns raw `.env` file contents
- POST endpoint modifies `.env` file via HTTP
- No authentication required
- Exposes: PINATA_JWT, PINATA_GATEWAY, and all other secrets

**Code:**
```typescript
export async function GET() {
  const envContent = fs.readFileSync(ENV_PATH, 'utf-8');
  return NextResponse.json({ env: envContent });  // ⚠️ EXPOSES ALL SECRETS
}
```

**Risk:** Complete compromise of all API credentials, JWT tokens, and configuration

**Recommendation:** DELETE THIS ENDPOINT IMMEDIATELY. Use only server-side environment variables.

---

### 3. **CRITICAL: Unrestricted File System Access (files/route.ts)**

**Location:** `src/app/api/files/route.ts`

**Vulnerability:**
- Path traversal checks exist but implementation has gaps
- Allows reading/writing to `dist`, `public`, `.` (root)
- No authentication required
- POST endpoint uploads arbitrary files
- Can write to sensitive directories

**Risk:** Remote code execution, data exfiltration, configuration tampering

**Recommendation:** 
- Remove file writing capabilities
- Restrict to read-only and specific directories only
- Add authentication

---

### 4. **HIGH: Insecure postMessage Communication (VisualEditsMessenger.tsx)**

**Location:** `src/visual-edits/VisualEditsMessenger.tsx`

**Vulnerability:**
```typescript
window.parent.postMessage(data, "*");  // ⚠️ WILDCARD TARGET
```

**Risks:**
- Posts messages to ANY origin with wildcard `"*"`
- Could leak UI state to malicious iframes
- Exposes focused element data and visual edit mode

**Recommendation:**
```typescript
window.parent.postMessage(data, window.location.origin);  // ✅ SPECIFIC ORIGIN
```

---

### 5. **HIGH: localStorage Usage Without Validation (VisualEditsMessenger.tsx)**

**Location:** `src/visual-edits/VisualEditsMessenger.tsx`

**Vulnerability:**
```typescript
const stored = localStorage.getItem(VISUAL_EDIT_MODE_KEY);
localStorage.setItem(VISUAL_EDIT_MODE_KEY, String(isVisualEditMode));
localStorage.setItem(FOCUSED_ELEMENT_KEY, focusedData);
```

**Risks:**
- Stores visual edit state persistently
- No encryption
- XSS could modify stored state
- Could be exploited to inject malicious UI modifications

**Recommendation:** Use `sessionStorage` for temporary state, or validate all data

---

### 6. **HIGH: ErrorReporter Sends to Parent Frame (ErrorReporter.tsx)**

**Location:** `src/components/ErrorReporter.tsx`

**Vulnerability:**
```typescript
const send = (payload: unknown) => window.parent.postMessage(payload, "*");

window.addEventListener("error", onError);
window.addEventListener("unhandledrejection", onReject);
```

**Risks:**
- Sends error details including stack traces to parent
- Could leak sensitive information about implementation
- Uses wildcard origin

**Recommendation:**
- Use specific origin
- Sanitize error messages
- Filter sensitive stack trace information

---

### 7. **HIGH: Pinata API Key in Environment (pinata/route.ts)**

**Location:** `src/app/api/pinata/route.ts`

**Vulnerability:**
```typescript
const pinata = new PinataSDK({
  pinataJwt: process.env.PINATA_JWT!,     // ⚠️ EXPOSED VIA /api/env
  pinataGateway: process.env.PINATA_GATEWAY!,
});
```

**Risks:**
- Credentials exposed via `/api/env` endpoint
- Can upload/modify IPFS data
- No request validation

**Recommendation:**
- Delete `/api/env` endpoint
- Add authentication to pinata endpoint
- Validate action parameter strictly

---

### 8. **MEDIUM: No Authentication on Cache APIs**

**Location:** 
- `src/app/api/bundle-cache/route.ts`
- `src/app/api/pool-cache/route.ts`

**Vulnerability:**
- Anyone can read/write bundle and pool cache
- No authentication required
- Can poison cache with malicious data
- Persistent modification of shared state

**Recommendation:**
- Add rate limiting
- Add request authentication
- Validate data structure
- Add CORS restrictions

---

### 9. **MEDIUM: No Input Validation on Bundle Cache**

**Location:** `src/app/api/bundle-cache/route.ts`

**Vulnerability:**
```typescript
const bundleData = {
  ...data,  // ⚠️ NO VALIDATION OF INPUT
  filename,
  bundleNumber,
  savedAt: new Date().toISOString()
};
```

**Risks:**
- Arbitrary JSON stored
- Could contain malicious scripts
- No schema validation

**Recommendation:** Use Zod or similar for strict validation

---

### 10. **MEDIUM: Exposed Developer Tools**

**Location:** `src/components/WhirlpoolApp.tsx`

**Vulnerability:**
- RPC URL can be changed via `window.prompt()`
- Pool addresses can be manually entered
- Direct access to blockchain operations
- Debug logging to console

**Risks:**
- Users could be socially engineered to enter malicious RPC URLs
- Malicious RPC could intercept transactions

**Recommendation:**
- Remove ability to change RPC at runtime
- Use only pre-configured, trusted RPCs
- Remove sensitive console logging

---

## 📊 Dependency Analysis

**No obvious malicious packages detected**, but audit critical packages:
- `@orca-so/whirlpools` (blockchain operations)
- `@solana/web3.js` (wallet integration)
- `pinata` (IPFS integration)
- `better-auth` (authentication)

---

## 🚨 Immediate Actions Required

### Priority 1 (DELETE IMMEDIATELY):
1. ❌ `/api/env` endpoint - exposes all secrets
2. ❌ `/api/keypair` endpoint - stores private keys

### Priority 2 (FIX IMMEDIATELY):
1. Fix `window.parent.postMessage("*")` to use origin
2. Add authentication to all cache APIs
3. Add input validation to all endpoints
4. Remove file write capabilities from files API

### Priority 3 (REVIEW):
1. Audit all fetch calls for CORS headers
2. Review ErrorReporter data leakage
3. Validate RPC endpoint handling
4. Add rate limiting to all APIs

---

## ✅ Safe Practices Found

- ✓ Path traversal protection in files API
- ✓ Good use of TypeScript for type safety
- ✓ Proper error handling in most places
- ✓ Safe use of crypto libraries (from @solana/web3.js)

---

## Testing Recommendations

1. **Penetration Test** the following:
   - POST /api/keypair with malicious data
   - GET /api/env access
   - Path traversal on /api/files
   - Cross-origin postMessage attempts

2. **Add Unit Tests** for:
   - Input validation on all endpoints
   - Authentication checks
   - Path safety validation

3. **Security Scanning**:
   - Run `npm audit`
   - Use OWASP ZAP for dynamic testing
   - Implement SAST tools in CI/CD

---

## Next Steps

1. Create a security fix branch
2. Address Priority 1 vulnerabilities
3. Add authentication middleware
4. Implement rate limiting
5. Add comprehensive input validation
6. Update documentation with security guidelines
