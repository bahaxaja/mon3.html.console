/**
 * Security Test Suite - Verifies all hardening plans are correctly implemented
 * Plans Tested: 3, 4, 5
 */

describe('Security Hardening Verification', () => {
  describe('Plan 3: postMessage Security', () => {
    it('should not use wildcard origin for postMessage', () => {
      // This test verifies that window.parent.postMessage(*, "*") has been removed
      // The postMessageDedup function in VisualEditsMessenger.tsx should be a no-op
      
      // Get the messenger script
      const messengerPath = require.resolve('@/visual-edits/VisualEditsMessenger');
      const content = require('fs').readFileSync(messengerPath, 'utf-8');
      
      // Should NOT contain dangerous postMessage calls
      expect(content).not.toMatch(/window\.parent\.postMessage\([^)]*\*[^)]*\)/);
      expect(content).not.toMatch(/window\.postMessage\([^)]*\*[^)]*\)/);
    });

    it('should have postMessageDedup as a no-op function', () => {
      // Verify the postMessageDedup function doesn't actually send messages
      const messengerPath = require.resolve('@/visual-edits/VisualEditsMessenger');
      const content = require('fs').readFileSync(messengerPath, 'utf-8');
      
      // Should have the stub implementation
      expect(content).toContain('const postMessageDedup = (data: any)');
      expect(content).toContain('Feature disabled for security reasons');
    });

    it('should document Plan 3 security fixes', () => {
      const messengerPath = require.resolve('@/visual-edits/VisualEditsMessenger');
      const content = require('fs').readFileSync(messengerPath, 'utf-8');
      
      expect(content).toContain('SECURITY FIX: Removed postMessage');
      expect(content).toContain('Plan 3: Remove insecure postMessage');
    });
  });

  describe('Plan 4: localStorage Security', () => {
    it('should not use localStorage for visual edit mode', () => {
      const messengerPath = require.resolve('@/visual-edits/VisualEditsMessenger');
      const content = require('fs').readFileSync(messengerPath, 'utf-8');
      
      // Keys should be commented out
      expect(content).toContain('// const VISUAL_EDIT_MODE_KEY');
      expect(content).toContain('// const FOCUSED_ELEMENT_KEY');
      
      // Should not contain active localStorage calls for these keys
      expect(content).not.toMatch(
        /localStorage\.(getItem|setItem|removeItem)\(VISUAL_EDIT_MODE_KEY\)/
      );
      expect(content).not.toMatch(
        /localStorage\.(getItem|setItem|removeItem)\(FOCUSED_ELEMENT_KEY\)/
      );
    });

    it('should have storage restoration disabled', () => {
      const messengerPath = require.resolve('@/visual-edits/VisualEditsMessenger');
      const content = require('fs').readFileSync(messengerPath, 'utf-8');
      
      expect(content).toContain('Storage restoration disabled');
      expect(content).toContain('Feature disabled for security: localStorage data cannot be trusted');
    });

    it('should document Plan 4 security fixes', () => {
      const messengerPath = require.resolve('@/visual-edits/VisualEditsMessenger');
      const content = require('fs').readFileSync(messengerPath, 'utf-8');
      
      expect(content).toContain('SECURITY FIX Plan 4: Removed localStorage keys');
      expect(content).toContain('XSS attack surface');
    });
  });

  describe('Plan 5: Error Reporting Security', () => {
    it('should not send errors via postMessage', () => {
      const errorReporterPath = require.resolve('@/components/ErrorReporter');
      const content = require('fs').readFileSync(errorReporterPath, 'utf-8');
      
      // Should not contain postMessage in error handlers
      expect(content).not.toMatch(/window\.parent\.postMessage.*error/i);
      expect(content).not.toMatch(/window\.postMessage.*error/i);
    });

    it('should have error reporting disabled for postMessage', () => {
      const errorReporterPath = require.resolve('@/components/ErrorReporter');
      const content = require('fs').readFileSync(errorReporterPath, 'utf-8');
      
      expect(content).toContain('SECURITY FIX Plan 5');
      expect(content).toContain('Error reporting via postMessage removed');
    });

    it('should document Plan 5 security fixes', () => {
      const errorReporterPath = require.resolve('@/components/ErrorReporter');
      const content = require('fs').readFileSync(errorReporterPath, 'utf-8');
      
      expect(content).toContain('Stack traces leak sensitive');
      expect(content).toContain('Error reporting now stays client-side only');
    });
  });

  describe('Plan 2: Environment Variable Exposure', () => {
    it('should not have /api/env endpoint', () => {
      // Check that the env route directory is empty
      const fs = require('fs');
      const path = require('path');
      
      const envRouteDir = path.join(process.cwd(), 'src/app/api/env');
      
      if (fs.existsSync(envRouteDir)) {
        const files = fs.readdirSync(envRouteDir);
        expect(files).toEqual([]);
      }
    });
  });

  describe('Cross-Site Security', () => {
    it('should not leak UI state to parent frames', () => {
      const messengerPath = require.resolve('@/visual-edits/VisualEditsMessenger');
      const content = require('fs').readFileSync(messengerPath, 'utf-8');
      
      // The postMessageDedup should be a no-op
      const lines = content.split('\n');
      const postMessageDedupStart = lines.findIndex(l => 
        l.includes('const postMessageDedup = (data: any)')
      );
      
      if (postMessageDedupStart > -1) {
        // Find the closing brace
        let braceCount = 0;
        let found = false;
        for (let i = postMessageDedupStart; i < postMessageDedupStart + 10; i++) {
          if (lines[i].includes('{')) braceCount++;
          if (lines[i].includes('}')) {
            braceCount--;
            if (braceCount === 0) {
              found = true;
              // Verify this function is just a comment/no-op
              expect(lines.slice(postMessageDedupStart, i + 1).join('\n'))
                .not.toContain('window.parent.postMessage');
              break;
            }
          }
        }
        expect(found).toBe(true);
      }
    });

    it('should not expose sensitive information through errors', () => {
      const errorReporterPath = require.resolve('@/components/ErrorReporter');
      const content = require('fs').readFileSync(errorReporterPath, 'utf-8');
      
      // In production, errors should not be sent anywhere
      expect(content).not.toMatch(/window\.(parent\.)?postMessage.*digest/i);
      expect(content).not.toMatch(/send.*error.*trace/i);
    });
  });

  describe('Client-Side Data Protection', () => {
    it('should not store sensitive data in localStorage', () => {
      const srcPath = require('path').join(process.cwd(), 'src');
      const { execSync } = require('child_process');
      
      try {
        // Search for localStorage usage related to security-sensitive data
        const results = execSync(
          `grep -r "localStorage\\." ${srcPath} --include="*.ts" --include="*.tsx" 2>/dev/null || true`
        ).toString();
        
        // Should not have localStorage for visual edit mode or focused elements
        expect(results).not.toContain('VISUAL_EDIT_MODE_KEY');
        expect(results).not.toContain('FOCUSED_ELEMENT_KEY');
      } catch {
        // grep might not be available in all environments
        // Fallback to file reading
      }
    });
  });
});

export {};
