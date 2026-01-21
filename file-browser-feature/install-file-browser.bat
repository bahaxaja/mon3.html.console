@echo off
REM File Browser Feature Installation Script for Windows
REM Extract this batch file to your project root and run: install-file-browser.bat
REM Usage: install-file-browser.bat (runs in current directory)
REM Or:    install-file-browser.bat C:\path\to\target-project

setlocal enabledelayedexpansion

REM Get the directory where this script is located
set SCRIPT_DIR=%~dp0
REM Remove trailing backslash
if "%SCRIPT_DIR:~-1%"=="\" set SCRIPT_DIR=%SCRIPT_DIR:~0,-1%

REM Determine target project
if "%1"=="" (
    set TARGET_PROJECT=%cd%
) else (
    set TARGET_PROJECT=%1
)

REM Check if target exists
if not exist "%TARGET_PROJECT%\." (
    echo ❌ Error: Target directory does not exist: %TARGET_PROJECT%
    exit /b 1
)

echo 🚀 Installing File Browser Feature...
echo Target Project: %TARGET_PROJECT%
echo Source Files: %SCRIPT_DIR%
echo.

REM Check for package.json
if not exist "%TARGET_PROJECT%\package.json" (
    echo ⚠️  Warning: package.json not found in target directory
    echo    Make sure this is a Next.js project root
    echo.
)

REM Create required directories
echo 📁 Creating directories...
if not exist "%TARGET_PROJECT%\src\lib\file-browser\components" mkdir "%TARGET_PROJECT%\src\lib\file-browser\components"
if not exist "%TARGET_PROJECT%\src\app\api\files" mkdir "%TARGET_PROJECT%\src\app\api\files"

REM Copy file browser library
echo 📁 Installing file browser library...
if exist "%SCRIPT_DIR%\file-browser\types.ts" copy "%SCRIPT_DIR%\file-browser\types.ts" "%TARGET_PROJECT%\src\lib\file-browser\" >nul && echo   ✓ types.ts
if exist "%SCRIPT_DIR%\file-browser\hooks.ts" copy "%SCRIPT_DIR%\file-browser\hooks.ts" "%TARGET_PROJECT%\src\lib\file-browser\" >nul && echo   ✓ hooks.ts
if exist "%SCRIPT_DIR%\file-browser\utils.ts" copy "%SCRIPT_DIR%\file-browser\utils.ts" "%TARGET_PROJECT%\src\lib\file-browser\" >nul && echo   ✓ utils.ts
if exist "%SCRIPT_DIR%\file-browser\index.ts" copy "%SCRIPT_DIR%\file-browser\index.ts" "%TARGET_PROJECT%\src\lib\file-browser\" >nul && echo   ✓ index.ts
if exist "%SCRIPT_DIR%\file-browser\FileBrowserContainer.tsx" copy "%SCRIPT_DIR%\file-browser\FileBrowserContainer.tsx" "%TARGET_PROJECT%\src\lib\file-browser\" >nul && echo   ✓ FileBrowserContainer.tsx
if exist "%SCRIPT_DIR%\file-browser\README.md" copy "%SCRIPT_DIR%\file-browser\README.md" "%TARGET_PROJECT%\src\lib\file-browser\" >nul && echo   ✓ README.md

REM Copy components
echo 🎨 Installing components...
if exist "%SCRIPT_DIR%\file-browser\components" (
    for %%f in ("%SCRIPT_DIR%\file-browser\components\*.tsx") do (
        copy "%%f" "%TARGET_PROJECT%\src\lib\file-browser\components\" >nul && echo   ✓ %%~nf
    )
)

REM Copy API route
echo 🔌 Installing API route...
if exist "%SCRIPT_DIR%\api\files\route.ts" (
    copy "%SCRIPT_DIR%\api\files\route.ts" "%TARGET_PROJECT%\src\app\api\files\" >nul && echo   ✓ route.ts
) else if exist "%SCRIPT_DIR%\route.ts" (
    copy "%SCRIPT_DIR%\route.ts" "%TARGET_PROJECT%\src\app\api\files\route.ts" >nul && echo   ✓ route.ts
)

REM Copy documentation files
echo 📖 Installing documentation...
if exist "%SCRIPT_DIR%\FILE_BROWSER_EXTRACTION_GUIDE.md" copy "%SCRIPT_DIR%\FILE_BROWSER_EXTRACTION_GUIDE.md" "%TARGET_PROJECT%\" >nul && echo   ✓ FILE_BROWSER_EXTRACTION_GUIDE.md
if exist "%SCRIPT_DIR%\FILE_BROWSER_INTEGRATION_CHECKLIST.md" copy "%SCRIPT_DIR%\FILE_BROWSER_INTEGRATION_CHECKLIST.md" "%TARGET_PROJECT%\" >nul && echo   ✓ FILE_BROWSER_INTEGRATION_CHECKLIST.md
if exist "%SCRIPT_DIR%\FILE_BROWSER_ARCHITECTURE.md" copy "%SCRIPT_DIR%\FILE_BROWSER_ARCHITECTURE.md" "%TARGET_PROJECT%\" >nul && echo   ✓ FILE_BROWSER_ARCHITECTURE.md
if exist "%SCRIPT_DIR%\README_FILE_BROWSER.md" copy "%SCRIPT_DIR%\README_FILE_BROWSER.md" "%TARGET_PROJECT%\" >nul && echo   ✓ README_FILE_BROWSER.md

echo.
echo ✅ Installation complete!
echo.
echo 📋 Next steps:
echo 1. Create a file page component:
echo    src\app\files\page.tsx
echo.
echo 2. Add this code:
echo    'use client';
echo    import { FileBrowserContainer } from '@/lib/file-browser';
echo    export default function FilesPage() {
echo      return ^<FileBrowserContainer /^>;
echo    }
echo.
echo 3. Verify Tailwind CSS is properly configured
echo 4. Test the /api/files endpoint
echo.
echo 📚 For detailed instructions, see: %TARGET_PROJECT%\FILE_BROWSER_EXTRACTION_GUIDE.md
echo.

pause
