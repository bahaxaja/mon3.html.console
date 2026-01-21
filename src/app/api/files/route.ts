import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const ALLOWED_ROOTS = ['dist', 'public', '.'];

function isPathSafe(requestedPath: string, root: string): boolean {
  const baseDir = root === '.' ? process.cwd() : path.join(process.cwd(), root);
  const resolved = path.resolve(baseDir, requestedPath);
  return resolved.startsWith(process.cwd());
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const root = searchParams.get('root') || 'public';
  const dir = searchParams.get('dir') || '';
  const action = searchParams.get('action') || 'list';
  const file = searchParams.get('file') || '';

  if (!ALLOWED_ROOTS.includes(root)) {
    return NextResponse.json({ error: 'Invalid root directory' }, { status: 400 });
  }

  if (!isPathSafe(dir, root)) {
    return NextResponse.json({ error: 'Invalid path' }, { status: 400 });
  }

  const fullPath = root === '.' ? path.join(process.cwd(), dir) : path.join(process.cwd(), root, dir);

  try {
    if (action === 'list') {
      try {
        await fs.access(fullPath);
      } catch {
        await fs.mkdir(fullPath, { recursive: true });
      }

      const entries = await fs.readdir(fullPath, { withFileTypes: true });
      const items = await Promise.all(
        entries.map(async (entry) => {
          const itemPath = path.join(fullPath, entry.name);
          const stats = await fs.stat(itemPath);
          return {
            name: entry.name,
            type: entry.isDirectory() ? 'directory' : 'file',
            size: stats.size,
            modified: stats.mtime.toISOString(),
            extension: entry.isFile() ? path.extname(entry.name).slice(1) : null,
          };
        })
      );

      items.sort((a, b) => {
        if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
        return a.name.localeCompare(b.name);
      });

      return NextResponse.json({ items, path: dir, root });
    }

      if (action === 'download' && file) {
        if (!isPathSafe(path.join(dir, file), root)) {
          return NextResponse.json({ error: 'Invalid file path' }, { status: 400 });
        }
        const filePath = path.join(fullPath, file);
        const content = await fs.readFile(filePath);
        return new NextResponse(content, {
          headers: {
            'Content-Type': 'application/octet-stream',
            'Content-Disposition': `attachment; filename="${file}"`,
          },
        });
      }

      if (action === 'read' && file) {
      if (!isPathSafe(path.join(dir, file), root)) {
        return NextResponse.json({ error: 'Invalid file path' }, { status: 400 });
      }
      const filePath = path.join(fullPath, file);
      const content = await fs.readFile(filePath, 'utf-8');
      const stats = await fs.stat(filePath);
      return NextResponse.json({ 
        content, 
        name: file, 
        size: stats.size,
        modified: stats.mtime.toISOString()
      });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { root, dir, action, name, content, newName } = body;

  if (!root || !ALLOWED_ROOTS.includes(root)) {
    return NextResponse.json({ error: 'Invalid root directory' }, { status: 400 });
  }

  if (!isPathSafe(dir || '', root)) {
    return NextResponse.json({ error: 'Invalid path' }, { status: 400 });
  }

  const fullPath = root === '.' ? path.join(process.cwd(), dir || '') : path.join(process.cwd(), root, dir || '');

  try {
    if (action === 'create-folder') {
      const newFolderPath = path.join(fullPath, name);
      if (!isPathSafe(path.join(dir || '', name), root)) {
        return NextResponse.json({ error: 'Invalid folder name' }, { status: 400 });
      }
      await fs.mkdir(newFolderPath, { recursive: true });
      return NextResponse.json({ success: true, message: `Folder "${name}" created` });
    }

    if (action === 'create-file') {
      const newFilePath = path.join(fullPath, name);
      if (!isPathSafe(path.join(dir || '', name), root)) {
        return NextResponse.json({ error: 'Invalid file name' }, { status: 400 });
      }
      await fs.writeFile(newFilePath, content || '');
      return NextResponse.json({ success: true, message: `File "${name}" created` });
    }

    if (action === 'rename') {
      const oldPath = path.join(fullPath, name);
      const newPath = path.join(fullPath, newName);
      if (!isPathSafe(path.join(dir || '', newName), root)) {
        return NextResponse.json({ error: 'Invalid new name' }, { status: 400 });
      }
      await fs.rename(oldPath, newPath);
      return NextResponse.json({ success: true, message: `Renamed to "${newName}"` });
    }

    if (action === 'delete') {
      const targetPath = path.join(fullPath, name);
      const stats = await fs.stat(targetPath);
      if (stats.isDirectory()) {
        await fs.rm(targetPath, { recursive: true });
      } else {
        await fs.unlink(targetPath);
      }
      return NextResponse.json({ success: true, message: `"${name}" deleted` });
    }

      if (action === 'save') {
        const filePath = path.join(fullPath, name);
        if (!isPathSafe(path.join(dir || '', name), root)) {
          return NextResponse.json({ error: 'Invalid file path' }, { status: 400 });
        }
        await fs.writeFile(filePath, content);
        return NextResponse.json({ success: true, message: `File "${name}" saved` });
      }

      if (action === 'upload') {
        const { files } = body;
        if (!files || !Array.isArray(files)) {
          return NextResponse.json({ error: 'No files provided' }, { status: 400 });
        }
        const results: string[] = [];
        for (const file of files) {
          if (!isPathSafe(path.join(dir || '', file.name), root)) {
            continue;
          }
          const filePath = path.join(fullPath, file.name);
          const buffer = Buffer.from(file.content, 'base64');
          await fs.writeFile(filePath, buffer);
          results.push(file.name);
        }
        return NextResponse.json({ success: true, message: `Uploaded ${results.length} file(s)`, files: results });
      }

      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
