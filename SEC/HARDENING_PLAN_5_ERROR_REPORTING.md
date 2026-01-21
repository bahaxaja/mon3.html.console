# Security Hardening Plan 5: Error Reporting (Stack Traces Leakage)

## Problem

### Current Code
```typescript
// ❌ VULNERABLE
const send = (payload: unknown) => window.parent.postMessage(payload, "*");

window.addEventListener("error", onError);
window.addEventListener("unhandledrejection", onReject);

// Sends full error details including:
// - Stack traces with file paths
// - Function names and line numbers
// - Internal implementation details
// - User data from error context
```

### Example Leaked Information

```javascript
// ❌ WHAT LEAKS
Error: Cannot read property 'secret' of undefined
  at decryptKeypair (/home/user/project/src/lib/encryption.ts:42:15)
  at async retrieveWallet (/home/user/project/src/app/api/keypair/route.ts:85:8)
  at async POST (/home/user/project/src/app/api/route.ts:120:5)
```

**Attacker learns:**
- Exact file paths (`/home/user/project/src/...`)
- Function names (`decryptKeypair`, `retrieveWallet`)
- API structure and order of operations
- Implementation details to craft better attacks

## Solution: REMOVE ALL
