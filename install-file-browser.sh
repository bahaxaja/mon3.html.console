#!/bin/bash

# File Browser Feature Installation Script for Linux/Mac
# Run this from the FILEBROWSER folder: bash install-file-browser.sh /path/to/target-project
# Usage: bash install-file-browser.sh /path/to/target-project

set -e

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Determine target project - require explicit path
if [ $# -eq 0 ]; then
    echo "❌ Error: Target project path required"
    echo ""
    echo "Usage: bash install-file-browser.sh /path/to/target-project"
    echo ""
    echo "Example:"
    echo "  bash install-file-browser.sh /home/user/my-nextjs-project"
    exit 1
fi

TARGET_PROJECT="$1"

# Check if target exists
if [ ! -d "$TARGET_PROJECT" ]; then
    echo "❌ Error: Target directory does not exist: $TARGET_PROJECT"
    exit 1
fi

echo "🚀 Installing File Browser Feature..."
echo "Target Project: $TARGET_PROJECT"
echo "Source Files: $SCRIPT_DIR"
echo ""

# Check for package.json
if [ ! -f "$TARGET_PROJECT/package.json" ]; then
    echo "⚠️  Warning: package.json not found in target directory"
    echo "    Make sure this is a Next.js project root"
    echo ""
fi

# Create required directories
echo "📁 Creating directories..."
mkdir -p "$TARGET_PROJECT/src/lib/file-browser/components"
mkdir -p "$TARGET_PROJECT/src/app/api/files"

# Copy file browser library
echo "📁 Installing file browser library..."
[ -f "$SCRIPT_DIR/file-browser/types.ts" ] && cp "$SCRIPT_DIR/file-browser/types.ts" "$TARGET_PROJECT/src/lib/file-browser/" && echo "   ✓ types.ts" || echo "   ⚠ types.ts not found"
[ -f "$SCRIPT_DIR/file-browser/hooks.ts" ] && cp "$SCRIPT_DIR/file-browser/hooks.ts" "$TARGET_PROJECT/src/lib/file-browser/" && echo "   ✓ hooks.ts" || echo "   ⚠ hooks.ts not found"
[ -f "$SCRIPT_DIR/file-browser/utils.ts" ] && cp "$SCRIPT_DIR/file-browser/utils.ts" "$TARGET_PROJECT/src/lib/file-browser/" && echo "   ✓ utils.ts" || echo "   ⚠ utils.ts not found"
[ -f "$SCRIPT_DIR/file-browser/index.ts" ] && cp "$SCRIPT_DIR/file-browser/index.ts" "$TARGET_PROJECT/src/lib/file-browser/" && echo "   ✓ index.ts" || echo "   ⚠ index.ts not found"
[ -f "$SCRIPT_DIR/file-browser/FileBrowserContainer.tsx" ] && cp "$SCRIPT_DIR/file-browser/FileBrowserContainer.tsx" "$TARGET_PROJECT/src/lib/file-browser/" && echo "   ✓ FileBrowserContainer.tsx" || echo "   ⚠ FileBrowserContainer.tsx not found"
[ -f "$SCRIPT_DIR/file-browser/README.md" ] && cp "$SCRIPT_DIR/file-browser/README.md" "$TARGET_PROJECT/src/lib/file-browser/" && echo "   ✓ README.md" || echo "   ⚠ README.md not found"

# Copy components
echo "🎨 Installing components..."
if [ -d "$SCRIPT_DIR/file-browser/components" ]; then
    for file in "$SCRIPT_DIR/file-browser/components"/*.tsx; do
        if [ -f "$file" ]; then
            cp "$file" "$TARGET_PROJECT/src/lib/file-browser/components/"
            echo "   ✓ $(basename "$file")"
        fi
    done
fi

# Copy API route
echo "🔌 Installing API route..."
if [ -f "$SCRIPT_DIR/api/files/route.ts" ]; then
    cp "$SCRIPT_DIR/api/files/route.ts" "$TARGET_PROJECT/src/app/api/files/"
    echo "   ✓ route.ts"
elif [ -f "$SCRIPT_DIR/route.ts" ]; then
    cp "$SCRIPT_DIR/route.ts" "$TARGET_PROJECT/src/app/api/files/route.ts"
    echo "   ✓ route.ts"
fi

# Copy documentation files
echo "📖 Installing documentation..."
[ -f "$SCRIPT_DIR/FILE_BROWSER_EXTRACTION_GUIDE.md" ] && cp "$SCRIPT_DIR/FILE_BROWSER_EXTRACTION_GUIDE.md" "$TARGET_PROJECT/" && echo "   ✓ FILE_BROWSER_EXTRACTION_GUIDE.md" || true
[ -f "$SCRIPT_DIR/FILE_BROWSER_INTEGRATION_CHECKLIST.md" ] && cp "$SCRIPT_DIR/FILE_BROWSER_INTEGRATION_CHECKLIST.md" "$TARGET_PROJECT/" && echo "   ✓ FILE_BROWSER_INTEGRATION_CHECKLIST.md" || true
[ -f "$SCRIPT_DIR/FILE_BROWSER_ARCHITECTURE.md" ] && cp "$SCRIPT_DIR/FILE_BROWSER_ARCHITECTURE.md" "$TARGET_PROJECT/" && echo "   ✓ FILE_BROWSER_ARCHITECTURE.md" || true
[ -f "$SCRIPT_DIR/README_FILE_BROWSER.md" ] && cp "$SCRIPT_DIR/README_FILE_BROWSER.md" "$TARGET_PROJECT/" && echo "   ✓ README_FILE_BROWSER.md" || true

echo ""
echo "✅ Installation complete!"
echo ""
echo "📋 Next steps:"
echo "1. Create a file page component:"
echo "   src/app/files/page.tsx"
echo ""
echo "2. Add this code:"
echo "   'use client';"
echo "   import { FileBrowserContainer } from '@/lib/file-browser';"
echo "   export default function FilesPage() {"
echo "     return <FileBrowserContainer />;"
echo "   }"
echo ""
echo "3. Verify Tailwind CSS is properly configured"
echo "4. Test the /api/files endpoint"
echo ""
echo "📚 For detailed instructions, see: $TARGET_PROJECT/FILE_BROWSER_EXTRACTION_GUIDE.md"
echo ""
