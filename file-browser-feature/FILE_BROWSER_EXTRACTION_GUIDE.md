# File Browser Feature - Extraction & Import Guide

## Overview

The file browser feature has been modularized and is now fully reusable. It's organized in `/src/lib/file-browser/` with a complete separation of concerns:

- **Components**: UI components for rendering
- **Hooks**: Business logic for file operations
- **Types**: TypeScript type definitions
- **Utils**: Utility functions for formatting and operations

## Quick Start - Using in Current Project

To use the file browser in the current project:

```typescript
// src/app/files/page.tsx (already updated)
'use client';

import { FileBrowserContainer } from '@/lib/file-browser';

export default function FileBrowser() {
  return (
    <FileBrowserContainer 
      backUrl="/" 
      showNavigation={true} 
      defaultRoot="public" 
    />
  );
}
```

## Extracting to Another Branch/Project

### Method 1: Direct File Copy

Copy the entire file browser directory to your target project:

```bash
# From the current project
cp -r src/lib/file-browser /path/to/target-project/src/lib/

# Also copy the API route
cp src/app/api/files/route.ts /path/to/target-project/src/app/api/
```

### Method 2: Git Subtree (if using git)

```bash
git subtree split --prefix=src/lib/file-browser --branch file-browser-feature
cd /path/to/target-project
git subtree add --prefix=src/lib/file-browser /path/to/current-project file-browser-feature
```

### Method 3: npm/yarn Monorepo

Create a workspace package:

```bash
npm install -w packages/file-browser
```

Then copy the files to `packages/file-browser/src`.

## File Structure Reference

```
src/lib/file-browser/
├── index.ts                          # Public API exports
├── types.ts                          # TypeScript types
├── hooks.ts                          # useFileBrowserState, useFileOperations
├── utils.ts                          # formatSize, formatDate, getFileIcon, downloadFile
├── FileBrowserContainer.tsx          # Main component (recommended)
├── README.md                         # Feature documentation
└── components/
    ├── FileBrowserNotification.tsx   # Toast notifications
    ├── FileBrowserHeader.tsx         # Navigation header
    ├── FileList.tsx                  # File listing sidebar
    ├── FileViewer.tsx                # File content viewer
    └── Dialogs.tsx                   # Create/Rename/Delete dialogs

src/app/api/files/
└── route.ts                          # Backend API (GET/POST handlers)
```

## Integration Checklist

When importing to another branch/project:

- [ ] Copy `/src/lib/file-browser` directory
- [ ] Copy `/src/app/api/files/route.ts` (or merge with existing)
- [ ] Verify Tailwind CSS is configured with:
  - `bg-black`, `bg-zinc-*`, `bg-amber-*`, `bg-red-*`, `bg-green-*`, `bg-blue-*`
  - `text-*` variants
  - `border-*` classes
  - `flex`, `flex-col`, `items-center`, etc.
- [ ] Create a page component that uses `FileBrowserContainer`
- [ ] Test the `/api/files` endpoint
- [ ] Update import paths if your project structure differs

## Advanced Usage Examples

### Example 1: Minimal Integration

```typescript
// src/app/files/page.tsx
'use client';

import { FileBrowserContainer } from '@/lib/file-browser';

export default function FilesPage() {
  return <FileBrowserContainer />;
}
```

### Example 2: With Custom Styling/Layout

```typescript
'use client';

import { FileBrowserHeader, FileList, FileViewer } from '@/lib/file-browser';
import { useFileBrowserState } from '@/lib/file-browser';

export default function CustomFileBrowser() {
  const state = useFileBrowserState('public');

  return (
    <div className="custom-layout">
      <FileBrowserHeader 
        root={state.root}
        currentPath={state.currentPath}
        onRootChange={state.setRoot}
        // ... other handlers
      />
      {/* Your custom layout */}
    </div>
  );
}
```

### Example 3: Embedded in Dashboard

```typescript
'use client';

import { FileBrowserContainer } from '@/lib/file-browser';

export default function Dashboard() {
  return (
    <div className="grid grid-cols-2">
      <div>Your Dashboard Content</div>
      <div className="border-l">
        <FileBrowserContainer 
          backUrl="/dashboard" 
          defaultRoot="public"
        />
      </div>
    </div>
  );
}
```

### Example 4: Using Individual Hooks

```typescript
'use client';

import { useFileBrowserState, useFileOperations } from '@/lib/file-browser';
import { formatSize } from '@/lib/file-browser';

export default function CustomComponent() {
  const state = useFileBrowserState('public');
  const ops = useFileOperations(
    state.root,
    state.currentPath,
    state.showNotification
  );

  // Custom implementation...
  return (
    <div>
      {state.items.map(item => (
        <div key={item.name}>
          {item.name} - {formatSize(item.size)}
        </div>
      ))}
    </div>
  );
}
```

## API Requirements

The file browser requires a Next.js API route at `/api/files`. It should handle:

### GET Requests
- `action=list` - List directory contents
- `action=read` - Read file contents
- `action=download` - Download file

### POST Requests
- `action=create-file` - Create new file
- `action=create-folder` - Create new folder
- `action=save` - Save file contents
- `action=rename` - Rename file/folder
- `action=delete` - Delete file/folder
- `action=upload` - Upload files (optional)

The included `src/app/api/files/route.ts` handles all these operations.

## Type Definitions

For TypeScript users, all types are exported from the index:

```typescript
import type {
  FileItem,
  FileContent,
  RootDirectory,
  NotificationState,
  FileBrowserConfig
} from '@/lib/file-browser';
```

## Customization Options

### Change Colors/Theme

Edit Tailwind classes in component files:
- Primary accent: `text-amber-*` → change to your color
- Background: `bg-black`, `bg-zinc-*` → customize
- Borders: `border-zinc-*`, `border-amber-*` → customize

### Change Icons

Edit `src/lib/file-browser/utils.ts` in `getFileIcon()` function:

```typescript
export const getFileIcon = (item: FileItem): string => {
  if (item.type === 'directory') return '📁'; // Change this
  // ... more customization
};
```

### Add Authentication

Wrap the component with authentication:

```typescript
'use client';

import { useAuth } from '@/hooks/useAuth';
import { FileBrowserContainer } from '@/lib/file-browser';

export default function FilesPage() {
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <div>Please log in</div>;
  }

  return <FileBrowserContainer />;
}
```

### Restrict Allowed Roots

Modify `/api/files/route.ts`:

```typescript
const ALLOWED_ROOTS = ['public']; // Only allow public
```

## Troubleshooting

### Issue: Imports not found
**Solution**: Verify the path alias `@` is configured in `tsconfig.json` or `jsconfig.json`

### Issue: Tailwind classes not applied
**Solution**: Ensure Tailwind CSS is properly configured and includes the file browser directory in its content scanning

### Issue: API 404 errors
**Solution**: Verify `/api/files/route.ts` exists and is properly configured in your target project

### Issue: Types not found
**Solution**: Ensure TypeScript strict mode is enabled and all imports use the correct paths

## Exporting to Different Project Structures

### Vite Project
```typescript
// vite.config.ts
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
```

### Create React App
Copy the file-browser folder to `src/lib/` (CRA already supports `src/` paths)

### Next.js (Different Structure)
Update import paths to match your structure (e.g., if no `@` alias, use relative imports)

## Version History

- **v1.0.0** (2026-01-16)
  - Initial modular release
  - Separated components, hooks, utils, and types
  - Fully documented and reusable

## Support

For issues or questions:
1. Check the [README.md](file-browser/README.md) in the file-browser directory
2. Review the component source code (well-commented)
3. Check the current implementation in `/src/app/files/page.tsx`

## License

This feature is part of the orchids-whirlpools-position-manager project.
