# Security Hardening Plan 3: Insecure postMessage (wildcard origin)

## Problem

### Current Code
```typescript
// ❌ VULNERABLE
window.parent.postMessage(data, "*");  // Sends to ANY origin
```

### Risk Analysis

**What can go wrong:**

1. **Data Leakage to Malicious Sites**
   - If app is embedded in `<iframe>` on attacker's site
   - Attacker's JavaScript receives all postMessage data
   - Data includes: UI state, element positions, focused elements

2. **Visual Edit Mode Hijacking**
   ```typescript
   // ❌ Attacker can see:
   {
     type: "ORCHIDS_HOVER_v1",
     msg: "HIT",
     id: "user-email-field",      // ← Can identify form fields
     tag: "input",
     rect: { top: 100, left: 50, width: 200, height: 40 }
   }
   ```

3. **Focused Element Tracking**
   - Attacker knows which element user is editing
   - Could be used for keystroke inference
   - Privacy leak about user interaction patterns

4. **SCROLL Attack**
   - Attacker sees scroll position
   - Could infer page length and content structure

## Solution: Remove Completly



## Testing: Create new tests to ensure its gone and all functionality like his is removed.

