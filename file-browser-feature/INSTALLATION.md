# 📦 File Browser Feature - Installation Package

## 🚀 Quick Installation

### Option 1: Mac/Linux
1. Extract this ZIP to your project root
2. Run: `./install-file-browser.sh`
3. Create `src/app/files/page.tsx` with the code below
4. Done!

### Option 2: Windows
1. Extract this ZIP to your project root
2. Double-click: `install-file-browser.bat`
3. Create `src\app\files\page.tsx` with the code below
4. Done!

### Option 3: Manual Install
1. Copy the `file-browser` folder to `src/lib/`
2. Copy `route.ts` to `src/app/api/files/`
3. Create page component (see below)

---

## 📝 Create Your File Browser Page

Create a new file: **`src/app/files/page.tsx`**

```typescript
'use client';

import { FileBrowserContainer } from '@/lib/file-browser';

export default function FilesPage() {
  return <FileBrowserContainer />;
}
```

---

## ✅ Requirements

Your project needs:
- ✅ Next.js 15+ with App Router
- ✅ React 19+
- ✅ Tailwind CSS configured
- ✅ TypeScript (recommended)

---

## 📚 Documentation

After installation, read:
- [FILE_BROWSER_EXTRACTION_GUIDE.md](FILE_BROWSER_EXTRACTION_GUIDE.md) - Detailed guide
- [FILE_BROWSER_INTEGRATION_CHECKLIST.md](FILE_BROWSER_INTEGRATION_CHECKLIST.md) - Step-by-step checklist
- [README_FILE_BROWSER.md](README_FILE_BROWSER.md) - Complete documentation index

---

## 🧪 Test It

1. Run your Next.js dev server: `npm run dev` (or `pnpm dev`)
2. Visit: `http://localhost:3000/files`
3. You should see the file browser!

---

## ⚙️ Configure (Optional)

### Change Default Root
In `src/app/files/page.tsx`:
```typescript
<FileBrowserContainer defaultRoot="dist" />
```

### Change Colors
Edit `src/lib/file-browser/components/` and replace:
- `text-amber-*` with your primary color
- `bg-black`, `bg-zinc-*` with your background colors

### Restrict Directories
Edit `src/app/api/files/route.ts`:
```typescript
const ALLOWED_ROOTS = ['public']; // Only allow public
```

---

## 🆘 Troubleshooting

### Scripts not working?
- **Mac/Linux**: Make script executable: `chmod +x install-file-browser.sh`
- **Windows**: Run Command Prompt as Administrator

### "Module not found" error?
- Check that `@` alias is in your `tsconfig.json`
- Verify Tailwind CSS includes `src/lib/file-browser/**`

### API 404 error?
- Verify `src/app/api/files/route.ts` exists
- Restart your dev server

---

## 📖 Full Documentation

See [FILE_BROWSER_EXTRACTION_GUIDE.md](FILE_BROWSER_EXTRACTION_GUIDE.md) for:
- ✅ Complete installation steps
- ✅ Customization options
- ✅ API documentation
- ✅ Troubleshooting guide

---

## 🎯 Quick Start Summary

| Step | Mac/Linux | Windows |
|------|-----------|---------|
| 1. Extract ZIP | Yes | Yes |
| 2. Run installer | `./install-file-browser.sh` | Double-click `install-file-browser.bat` |
| 3. Create page | `src/app/files/page.tsx` | `src\app\files\page.tsx` |
| 4. Run dev server | `npm run dev` | `npm run dev` |
| 5. Visit | `http://localhost:3000/files` | `http://localhost:3000/files` |

---

## ✨ What You Get

- 📁 Full file browser component
- 👁️ File viewer with syntax highlighting
- ✏️ Built-in editor
- ➕ Create files & folders
- ✏️ Rename items
- 🗑️ Delete with confirmation
- ⬇️ Download files
- 🔒 Security validation
- 🎨 Dark theme UI

---

## 📞 Need Help?

1. Check the docs: [FILE_BROWSER_EXTRACTION_GUIDE.md](FILE_BROWSER_EXTRACTION_GUIDE.md)
2. Read the checklist: [FILE_BROWSER_INTEGRATION_CHECKLIST.md](FILE_BROWSER_INTEGRATION_CHECKLIST.md)
3. Review the code comments in `src/lib/file-browser/`

---

## 📖 More Information

For complete details, see:
- [README_FILE_BROWSER.md](README_FILE_BROWSER.md) - Documentation index
- [FILE_BROWSER_EXTRACTION_GUIDE.md](FILE_BROWSER_EXTRACTION_GUIDE.md) - Troubleshooting

**Enjoy your file browser! 🎉**
