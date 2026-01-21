#!/bin/bash

# File Browser Feature Extraction Script
# Extract this script's folder to your project root and run: ./install-file-browser.sh
# Usage: ./install-file-browser.sh (runs in current directory)
# Or:    ./install-file-browser.sh /path/to/target-project

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Determine target project
if [ -n "$1" ]; then
    TARGET_PROJECT="$1"
else
    TARGET_PROJECT="."
fi

# Resolve to absolute path
TARGET_PROJECT="$(cd "$TARGET_PROJECT" 2>/dev/null && pwd)" || {
    echo "❌ Error: Target directory does not exist: $1"
    exit 1
}

echo "🚀 Installing File Browser Feature..."
echo "Target Project: $TARGET_PROJECT"
echo "Source Files: $SCRIPT_DIR"
echo ""

# Check if we're in a Next.js project
if [ ! -f "$TARGET_PROJECT/package.json" ]; then
    echo "⚠️  Warning: package.json not found in target directory"
    echo "   Make sure this is a Next.js project root"
    echo ""
fi

# Create required directories
echo "📁 Creating directories..."
mkdir -p "$TARGET_PROJECT/src/lib/file-browser/components"
mkdir -p "$TARGET_PROJECT/src/app/api/files"

# Copy file browser library
echo "📁 Installing file browser library..."
[ -f "$SCRIPT_DIR/file-browser/types.ts" ] && cp -v "$SCRIPT_DIR/file-browser/types.ts" "$TARGET_PROJECT/src/lib/file-browser/"
[ -f "$SCRIPT_DIR/file-browser/hooks.ts" ] && cp -v "$SCRIPT_DIR/file-browser/hooks.ts" "$TARGET_PROJECT/src/lib/file-browser/"
[ -f "$SCRIPT_DIR/file-browser/utils.ts" ] && cp -v "$SCRIPT_DIR/file-browser/utils.ts" "$TARGET_PROJECT/src/lib/file-browser/"
[ -f "$SCRIPT_DIR/file-browser/index.ts" ] && cp -v "$SCRIPT_DIR/file-browser/index.ts" "$TARGET_PROJECT/src/lib/file-browser/"
[ -f "$SCRIPT_DIR/file-browser/FileBrowserContainer.tsx" ] && cp -v "$SCRIPT_DIR/file-browser/FileBrowserContainer.tsx" "$TARGET_PROJECT/src/lib/file-browser/"
[ -f "$SCRIPT_DIR/file-browser/README.md" ] && cp -v "$SCRIPT_DIR/file-browser/README.md" "$TARGET_PROJECT/src/lib/file-browser/"

# Copy components
echo "🎨 Installing components..."
if [ -d "$SCRIPT_DIR/file-browser/components" ]; then
    cp -v "$SCRIPT_DIR/file-browser/components/"*.tsx "$TARGET_PROJECT/src/lib/file-browser/components/" 2>/dev/null
fi

# Copy API route
echo "🔌 Installing API route..."
if [ -d "$SCRIPT_DIR/api/files" ]; then
    cp -v "$SCRIPT_DIR/api/files/route.ts" "$TARGET_PROJECT/src/app/api/files/"
elif [ -f "$SCRIPT_DIR/route.ts" ]; then
    cp -v "$SCRIPT_DIR/route.ts" "$TARGET_PROJECT/src/app/api/files/route.ts"
fi

# Copy documentation files
echo "📖 Installing documentation..."
[ -f "$SCRIPT_DIR/FILE_BROWSER_EXTRACTION_GUIDE.md" ] && cp -v "$SCRIPT_DIR/FILE_BROWSER_EXTRACTION_GUIDE.md" "$TARGET_PROJECT/"
[ -f "$SCRIPT_DIR/FILE_BROWSER_INTEGRATION_CHECKLIST.md" ] && cp -v "$SCRIPT_DIR/FILE_BROWSER_INTEGRATION_CHECKLIST.md" "$TARGET_PROJECT/"
[ -f "$SCRIPT_DIR/FILE_BROWSER_ARCHITECTURE.md" ] && cp -v "$SCRIPT_DIR/FILE_BROWSER_ARCHITECTURE.md" "$TARGET_PROJECT/"
[ -f "$SCRIPT_DIR/README_FILE_BROWSER.md" ] && cp -v "$SCRIPT_DIR/README_FILE_BROWSER.md" "$TARGET_PROJECT/"

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
