# File Browser Feature - Integration Checklist

Use this checklist when importing the file browser feature to another branch or project.

## Pre-Import Steps

- [ ] Identify the target project/branch
- [ ] Ensure target has Next.js 15+ with App Router
- [ ] Verify Tailwind CSS is configured
- [ ] Check if there's already a `/src/app/api/files/route.ts`

## Import Steps

### 1. Copy Files
- [ ] Copy `src/lib/file-browser/` directory
- [ ] Copy `src/app/api/files/route.ts` (or merge if exists)

### 2. Verify Imports
- [ ] Check `@` alias is configured in `tsconfig.json`
- [ ] Update import paths if project structure differs
- [ ] Verify no import conflicts

### 3. Create Page Component
```typescript
// src/app/files/page.tsx or wherever you want it
'use client';

import { FileBrowserContainer } from '@/lib/file-browser';

export default function FilesPage() {
  return <FileBrowserContainer />;
}
```

- [ ] Create the page component
- [ ] Add to navigation/routing if needed

### 4. Tailwind CSS Configuration
- [ ] Verify Tailwind content includes: `src/**/*.{js,ts,tsx}`
- [ ] Check these color classes are available:
  - [ ] `bg-black`, `bg-zinc-*`, `bg-amber-*`, `bg-red-*`, `bg-green-*`, `bg-blue-*`
  - [ ] `text-amber-*`, `text-zinc-*`, `text-red-*`, `text-green-*`
  - [ ] `border-*`, `border-l`, `border-r`, `border-b`
- [ ] Check layout classes: `flex`, `flex-col`, `flex-1`, `items-center`, `gap-*`
- [ ] Check sizing: `w-full`, `h-full`, `min-h-screen`, `overflow-*`, `z-50`

### 5. Test API
- [ ] Test GET `/api/files?root=public&dir=&action=list`
- [ ] Test listing files
- [ ] Test reading files
- [ ] Test file operations (create, save, rename, delete)
- [ ] Check error handling

### 6. Test UI
- [ ] [ ] File listing displays
- [ ] [ ] Can navigate directories
- [ ] [ ] Can view file contents
- [ ] [ ] Can edit files
- [ ] [ ] Can create files/folders
- [ ] [ ] Can rename files/folders
- [ ] [ ] Can delete files/folders
- [ ] [ ] Can switch between roots (., public, dist)
- [ ] [ ] Notifications display correctly
- [ ] [ ] Responsive design works

## Customization Steps (Optional)

### Change Theme Colors
- [ ] Edit component files
- [ ] Replace `text-amber-*` with your primary color
- [ ] Update `bg-zinc-*` if desired
- [ ] Test all interactive states

### Change Default Root
- [ ] Update `defaultRoot` prop in page component
- [ ] Or modify `useFileBrowserState('public')` in `hooks.ts`

### Restrict Allowed Roots
- [ ] Edit `src/app/api/files/route.ts`
- [ ] Modify `const ALLOWED_ROOTS = ['dist', 'public', '.']`

### Add Authentication
- [ ] Wrap `FileBrowserContainer` in auth check
- [ ] Or add auth middleware to API route
- [ ] Test unauthorized access is blocked

### Change Icons
- [ ] Edit `src/lib/file-browser/utils.ts`
- [ ] Update `getFileIcon()` function
- [ ] Test with different file types

## Integration Points

### If Using Shared Layouts
- [ ] Add link to file browser in navigation
- [ ] Update breadcrumbs if applicable
- [ ] Style to match your design system

### If Using Custom API Auth
- [ ] Add auth check to `/api/files/route.ts`
- [ ] Implement user-specific file access control
- [ ] Test authorization

### If Using File Upload Feature
- [ ] Verify `upload` action in API
- [ ] Test file upload endpoint
- [ ] Set file size limits if needed

## Performance Considerations

- [ ] Test with large directories (100+ files)
- [ ] Monitor API response times
- [ ] Consider pagination if needed
- [ ] Check memory usage with large files

## Deployment

- [ ] Test in staging environment
- [ ] Verify API routes are accessible
- [ ] Check file permissions on server
- [ ] Test all CRUD operations work
- [ ] Monitor error logs

## Documentation

- [ ] Update project README
- [ ] Document file browser location/URL
- [ ] Add to user documentation if applicable
- [ ] Create any custom docs for your team

## Post-Import Verification

- [ ] File browser loads without errors
- [ ] Console shows no warnings/errors
- [ ] Network tab shows API calls succeeding
- [ ] All UI elements render correctly
- [ ] All features are functional

## Troubleshooting Quick Reference

| Issue | Solution |
|-------|----------|
| Import errors | Check `@` alias in `tsconfig.json` |
| Styles not applying | Verify Tailwind includes file-browser paths |
| API 404 errors | Check `/api/files/route.ts` exists |
| Type errors | Ensure TypeScript strict mode settings |
| File listing empty | Check read permissions on directories |
| Save not working | Verify write permissions, check API logs |

## Rollback Plan

If issues occur:

1. [ ] Keep backup of original files
2. [ ] Note any custom modifications
3. [ ] Remove file browser files if needed
4. [ ] Restore from backup if necessary
5. [ ] Document what went wrong

## Sign-Off

- [ ] All tests pass
- [ ] No console errors
- [ ] Performance acceptable
- [ ] Documentation updated
- [ ] Ready for production

---

**Checklist Version:** 1.0  
**Last Updated:** 2026-01-16  
**Status:** Ready to use
