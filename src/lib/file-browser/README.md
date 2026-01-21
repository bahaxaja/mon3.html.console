# File Browser Feature

A modular, reusable file browser component for Next.js applications. This feature allows users to browse, view, edit, create, delete, and manage files across different directory roots.

## Features

- 📁 Browse files and directories
- 📝 View and edit file contents
- 💾 Save file changes
- ➕ Create new files and folders
- ✏️ Rename files and folders
- 🗑️ Delete files and folders
- ⬇️ Download files
- 🎯 Multi-root directory support (root, public, dist)
- 🔒 Path safety validation

## Installation

### 1. Copy the API Route

The file browser requires a backend API. Ensure you have `/src/app/api/files/route.ts` configured:

```typescript
// Already included in the project
```

### 2. Import the Component

In your Next.js page or component:

```typescript
'use client';

import { FileBrowserContainer } from '@/lib/file-browser';

export default function FilesPage() {
  return <FileBrowserContainer />;
}
```

## Usage

### Basic Usage

```typescript
import { FileBrowserContainer } from '@/lib/file-browser';

export default function FilesPage() {
  return (
    <FileBrowserContainer
      defaultRoot="public"
      backUrl="/"
      showNavigation={true}
    />
  );
}
```

### Custom Integration with Hooks

For more control, use the individual hooks and components:

```typescript
'use client';

import React from 'react';
import { useFileBrowserState, useFileOperations } from '@/lib/file-browser';
import { FileBrowserHeader, FileList, FileViewer } from '@/lib/file-browser';

export default function CustomFileBrowser() {
  const state = useFileBrowserState('public');
  const operations = useFileOperations(
    state.root,
    state.currentPath,
    state.showNotification
  );

  // Your custom layout here
  return (
    <div>
      <FileBrowserHeader
        root={state.root}
        currentPath={state.currentPath}
        onRootChange={state.setRoot}
        // ... other props
      />
      {/* Your custom layout */}
    </div>
  );
}
```

### Using Individual Components

```typescript
import {
  FileBrowserNotification,
  FileList,
  FileViewer,
  CreateDialog,
} from '@/lib/file-browser';
```

### Using Hooks

```typescript
import {
  useFileBrowserState,
  useFileOperations,
} from '@/lib/file-browser';
```

### Using Utilities

```typescript
import {
  formatSize,
  formatDate,
  getFileIcon,
  downloadFile,
} from '@/lib/file-browser';
```

## Props

### FileBrowserContainer

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `backUrl` | string | `/` | URL for the back navigation button |
| `showNavigation` | boolean | true | Show/hide the back button |
| `defaultRoot` | '.' \| 'dist' \| 'public' | 'public' | Default root directory |

## API Requirements

The file browser expects a Next.js API route at `/api/files` with the following endpoints:

### GET /api/files

**Query Parameters:**
- `root` - Directory root ('.' \| 'dist' \| 'public')
- `dir` - Current directory path
- `action` - Action to perform ('list' \| 'read' \| 'download')
- `file` - File name (for read/download actions)

**Supported Actions:**
- `list` - List files in directory
- `read` - Read file contents
- `download` - Download file

### POST /api/files

**Body Parameters:**
- `root` - Directory root
- `dir` - Current directory path
- `action` - Action to perform
- Additional fields depend on the action

**Supported Actions:**
- `create-file` - Create a new file
- `create-folder` - Create a new folder
- `save` - Save file contents
- `rename` - Rename a file/folder
- `delete` - Delete a file/folder
- `upload` - Upload files

## Types

```typescript
// Main types
export interface FileItem {
  name: string;
  type: 'file' | 'directory';
  size: number;
  modified: string;
  extension: string | null;
}

export interface FileContent {
  content: string;
  name: string;
  size: number;
  modified: string;
}

export type RootDirectory = '.' | 'dist' | 'public';
```

## File Structure

```
src/lib/file-browser/
├── FileBrowserContainer.tsx    # Main component
├── types.ts                     # Type definitions
├── hooks.ts                     # Custom hooks
├── utils.ts                     # Utility functions
├── index.ts                     # Public exports
├── README.md                    # Documentation
└── components/
    ├── FileBrowserNotification.tsx
    ├── FileBrowserHeader.tsx
    ├── FileList.tsx
    ├── FileViewer.tsx
    └── Dialogs.tsx
```

## Extracting to Another Project

To use this file browser in another project:

1. **Copy the file browser directory:**
   ```bash
   cp -r src/lib/file-browser /path/to/other-project/src/lib/
   ```

2. **Copy the API route:**
   ```bash
   cp src/app/api/files/route.ts /path/to/other-project/src/app/api/
   ```

3. **Ensure Tailwind CSS is configured** in your target project with these classes:
   - `min-h-screen`, `bg-black`, `text-zinc-*`, `border-*`, `flex`, `flex-col`, etc.

4. **Import and use:**
   ```typescript
   import { FileBrowserContainer } from '@/lib/file-browser';
   ```

## Styling

This component uses Tailwind CSS with a dark terminal-like theme. All styles are in the components using Tailwind classes. The theme uses:
- `bg-black` / `bg-zinc-*` for backgrounds
- `text-amber-*` for primary accent color
- `text-red-*` for error states
- `text-green-*` for success states

To customize the theme, modify the Tailwind classes in the component files.

## Security Considerations

- ✅ Path safety validation is performed server-side
- ✅ Only allowed root directories can be accessed
- ✅ Symbolic link attacks are prevented
- ⚠️ Ensure your API route has proper authentication/authorization

## License

This feature is part of the orchids-whirlpools-position-manager project.
