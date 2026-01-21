# File Browser Architecture & Component Tree

## 📊 Component Hierarchy

```
┌─────────────────────────────────────────────────────────────┐
│                  FileBrowserContainer                       │
│                (Main orchestrator component)                │
└────────┬────────────────────────────────────────────────────┘
         │
         ├─── Manages state with: useFileBrowserState()
         ├─── Handles operations with: useFileOperations()
         └─── Renders 5 sub-components:
         │
         ├──────────────────────────────────────────────────────┐
         │                                                      │
         ├─ ┌──────────────────────────────────────────────┐    │
         │  │    FileBrowserNotification (Fixed overlay)   │    │
         │  │  Displays success/error messages for 3s      │    │
         │  └──────────────────────────────────────────────┘    │
         │                                                      │
         ├─ ┌──────────────────────────────────────────────┐    │
         │  │    FileBrowserHeader (Top navigation bar)    │    │
         │  ├─ Back button link                           │    │
         │  ├─ Title: "FILE BROWSER"                      │    │
         │  └─ Root selector (. / public / dist buttons)  │    │
         │  └─ Breadcrumb navigation (root > path)        │    │
         │  └─ Action buttons (+ FOLDER, + FILE, REFRESH) │    │
         │  └──────────────────────────────────────────────┘    │
         │                                                      │
         ├─────────────── Main Content Area ────────────────────┤
         │                                                      │
         ├─ ┌──────────────────────┐  ┌──────────────────────┐│
         │  │   FileList           │  │   FileViewer        ││
         │  │  (1/3 width)         │  │  (2/3 width)        ││
         │  │                      │  │                     ││
         │  │ Displays:            │  │ Shows:              ││
         │  │ • Directory contents │  │ • Selected file     ││
         │  │ • File/folder icons  │  │ • Content preview   ││
         │  │ • File sizes         │  │ • Edit mode         ││
         │  │ • .. button to go up │  │ • Save/Edit buttons ││
         │  │ • Rename/Delete btns │  │ • Download button   ││
         │  │                      │  │                     ││
         │  └──────────────────────┘  └──────────────────────┘│
         │                                                      │
         └──────────────────────────────────────────────────────┘
         │
         └─ ┌──────────────────────────────────────────────┐
            │           Modal Dialogs (Fixed overlay)       │
            ├─ CreateDialog (Create file/folder)          │
            │ ├─ Text input field                         │
            │ ├─ Cancel button                            │
            │ └─ Create button                            │
            │                                              │
            ├─ RenameDialog (Rename file/folder)          │
            │ ├─ Text input with current name             │
            │ ├─ Cancel button                            │
            │ └─ Rename button                            │
            │                                              │
            └─ DeleteDialog (Confirm deletion)            │
              ├─ Warning message                          │
              ├─ Cancel button                            │
              └─ Delete button (red)                      │
            └──────────────────────────────────────────────┘
```

## 🎯 Data Flow

```
User Action → FileBrowserContainer → State Update → Re-render
                        ↓
                   useFileOperations()
                        ↓
                    API Call to /api/files
                        ↓
                   Backend Processing
                        ↓
                   JSON Response
                        ↓
                   Update State/Show Notification
                        ↓
                   Re-render Components
```

## 📁 Module Organization

```
src/lib/file-browser/
│
├── 🎯 PUBLIC API (index.ts)
│   ├─ FileBrowserContainer
│   ├─ Components (6)
│   ├─ Hooks (2)
│   ├─ Utils (4 functions)
│   └─ Types (5 interfaces)
│
├── 🎨 COMPONENTS (components/)
│   ├─ FileBrowserNotification
│   │  ├─ Props: notification (NotificationState | null)
│   │  └─ Renders: Toast message overlay
│   │
│   ├─ FileBrowserHeader
│   │  ├─ Props: root, currentPath, callbacks, options
│   │  └─ Renders: Navigation bar with breadcrumbs & buttons
│   │
│   ├─ FileList
│   │  ├─ Props: items, selectedFile, loading, callbacks
│   │  └─ Renders: Left sidebar with file listing
│   │
│   ├─ FileViewer
│   │  ├─ Props: selectedFile, editContent, callbacks
│   │  └─ Renders: Right pane with file content/editor
│   │
│   └─ Dialogs
│      ├─ CreateDialog (Create file/folder)
│      ├─ RenameDialog (Rename item)
│      └─ DeleteDialog (Confirm deletion)
│
├── 🪝 HOOKS (hooks.ts)
│   ├─ useFileBrowserState()
│   │  ├─ Manages all UI state
│   │  ├─ root, currentPath, items, selectedFile
│   │  ├─ loading, error, notification
│   │  └─ Returns: Full state object + setters
│   │
│   └─ useFileOperations()
│      ├─ Manages all file operations
│      ├─ loadDirectory()
│      ├─ openFile()
│      ├─ saveFile()
│      ├─ createNew()
│      ├─ rename()
│      └─ deleteItem()
│
├── 🛠️ UTILITIES (utils.ts)
│   ├─ formatSize(bytes) → "1.5 KB"
│   ├─ formatDate(iso) → "1/16/2026, 2:30 PM"
│   ├─ getFileIcon(item) → "📄" emoji
│   └─ downloadFile(root, path, name) → triggers download
│
├── 📘 TYPES (types.ts)
│   ├─ FileItem {name, type, size, modified, extension}
│   ├─ FileContent {content, name, size, modified}
│   ├─ RootDirectory ('.' | 'dist' | 'public')
│   ├─ NotificationState {message, type}
│   └─ FileBrowserConfig (future use)
│
└── 📄 MAIN COMPONENT (FileBrowserContainer.tsx)
   └─ Orchestrates everything
      ├─ Uses hooks for state & operations
      ├─ Manages dialog states
      ├─ Handles all callbacks
      └─ Renders child components
```

## 🔄 State Management Pattern

```
┌────────────────────────────────────────────────┐
│         FileBrowserContainer State              │
├────────────────────────────────────────────────┤
│                                                 │
│  From useFileBrowserState():                   │
│  ├─ root: RootDirectory                        │
│  ├─ currentPath: string                        │
│  ├─ items: FileItem[]                          │
│  ├─ selectedFile: FileContent | null           │
│  ├─ loading: boolean                           │
│  ├─ error: string | null                       │
│  └─ notification: NotificationState | null     │
│                                                 │
│  Local component state:                        │
│  ├─ showNewDialog: 'file' | 'folder' | null   │
│  ├─ newName: string                            │
│  ├─ renameItem: FileItem | null                │
│  ├─ renameName: string                         │
│  ├─ confirmDelete: FileItem | null             │
│  ├─ editContent: string                        │
│  └─ isEditing: boolean                         │
│                                                 │
└────────────────────────────────────────────────┘
         ↓
    useEffect triggers loadDirectory()
         ↓
    API call to /api/files?action=list
         ↓
    setItems(response.items)
         ↓
    Components re-render with new data
```

## 🔌 API Integration Points

```
┌──────────────────────────────────────────────────┐
│        FileBrowserContainer                      │
│  useFileOperations(root, currentPath, notify)   │
└──────────┬───────────────────────────────────────┘
           │
           ├─── loadDirectory() ─────────────┐
           │                                  │
           ├─── openFile() ───────────────┐  │
           │                               │  │
           ├─── saveFile() ───────┐        │  │
           │                      │        │  │
           ├─── createNew() ──┐   │        │  │
           │                  │   │        │  │
           ├─── rename() ───┐ │   │        │  │
           │                │ │   │        │  │
           └─── deleteItem()│ │   │        │  │
                            │ │   │        │  │
                            ↓ ↓   ↓        ↓  ↓
            ┌─────────────────────────────────────┐
            │   /api/files (Next.js Route)        │
            ├─────────────────────────────────────┤
            │                                     │
            │  GET /api/files (Query actions)    │
            │  ├─ action=list    → ls directory  │
            │  ├─ action=read    → read file     │
            │  └─ action=download → download     │
            │                                     │
            │  POST /api/files (Mutation actions)│
            │  ├─ action=create-file             │
            │  ├─ action=create-folder           │
            │  ├─ action=save                    │
            │  ├─ action=rename                  │
            │  ├─ action=delete                  │
            │  └─ action=upload                  │
            │                                     │
            └─────────────────────────────────────┘
                            ↓
                    File System Operations
                    ├─ fs.readdir()
                    ├─ fs.readFile()
                    ├─ fs.writeFile()
                    ├─ fs.mkdir()
                    ├─ fs.rename()
                    ├─ fs.rm()
                    └─ fs.stat()
```

## 🎨 Styling Pattern

```
FileBrowserContainer
├─ Classes applied globally
│  └─ min-h-screen bg-black text-zinc-300 font-mono flex flex-col
│
└─ Child components each have their own styling:
   ├─ FileBrowserHeader
   │  └─ bg-zinc-950 border-b border-zinc-800 px-4 py-3
   │     └─ h1: text-amber-500 font-bold text-sm
   │     └─ buttons: bg-amber-600 or bg-zinc-900 with hover states
   │
   ├─ FileList (left sidebar)
   │  └─ w-1/3 border-r border-zinc-800
   │     └─ items: text-zinc-300 or text-amber-500 on hover:bg-zinc-900
   │
   ├─ FileViewer (right pane)
   │  └─ flex-1 bg-zinc-950
   │     └─ textarea: bg-black border border-zinc-800 focus:border-amber-600
   │
   └─ Dialogs (modals)
      ├─ Fixed overlay: fixed inset-0 bg-black/80 z-50
      ├─ Dialog box: bg-zinc-900 border border-zinc-700 (or red-800)
      ├─ Input: bg-black border border-zinc-700 focus:border-amber-600
      └─ Buttons: bg-amber-600 (primary) or bg-red-700 (danger)
```

## 📦 Dependency Tree

```
FileBrowserContainer.tsx
├── Requires: React, useState, useEffect, useCallback
├── Imports from ./types
├── Imports from ./hooks
├── Imports from ./utils
└── Imports from ./components

./hooks.ts
├── Requires: useCallback, useState (React)
├── Imports from ./types
└── Uses fetch API

./utils.ts
├── No React dependencies
├── Imports from ./types
└── Pure functions

./components/*
├── Requires: React
├── All import from ../types
└── No inter-component dependencies

./types.ts
└── No dependencies (pure TypeScript)
```

## 🧪 Testing Architecture

```
Components can be tested independently:
├─ FileBrowserNotification (pure props)
├─ FileBrowserHeader (pure props + callbacks)
├─ FileList (pure props + callbacks)
├─ FileViewer (pure props + callbacks)
└─ Dialogs (pure props + callbacks)

Hooks can be tested in isolation:
├─ useFileBrowserState (state management)
└─ useFileOperations (API integration)

Utils are pure functions:
├─ formatSize()
├─ formatDate()
├─ getFileIcon()
└─ downloadFile()

API can be mocked in tests:
└─ Mock fetch calls to /api/files
```

## 🔐 Security Architecture

```
Client Side:
├─ Path validation in utils
└─ UI prevents invalid paths

Server Side (/api/files/route.ts):
├─ ALLOWED_ROOTS whitelist
├─ isPathSafe() validation
├─ path.resolve() verification
└─ Prevent directory traversal
```

---

This architecture ensures:
- ✅ Separation of concerns
- ✅ Easy to test
- ✅ Easy to maintain
- ✅ Easy to extend
- ✅ Easy to extract to other projects
