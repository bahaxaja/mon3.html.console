/**
 * File Browser Feature - Header Component
 */

import React from 'react';
import Link from 'next/link';
import { RootDirectory } from '../types';

interface Props {
  root: RootDirectory;
  currentPath: string;
  onRootChange: (root: RootDirectory) => void;
  onCreateFolder: () => void;
  onCreateFile: () => void;
  onRefresh: () => void;
  backUrl?: string;
  showNavigation?: boolean;
}

export const FileBrowserHeader: React.FC<Props> = ({
  root,
  currentPath,
  onRootChange,
  onCreateFolder,
  onCreateFile,
  onRefresh,
  backUrl = '/',
  showNavigation = true,
}) => {
  return (
    <>
      <header className="bg-zinc-950 border-b border-zinc-800 px-4 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          {showNavigation && (
            <Link href={backUrl} className="text-amber-500 hover:text-amber-400 text-xs font-bold uppercase tracking-wider">
              ← BACK
            </Link>
          )}
          <h1 className="text-amber-500 font-bold text-sm uppercase tracking-wider">FILE BROWSER</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onRootChange('.')}
            className={`px-3 py-1 text-[10px] font-bold uppercase border transition-colors ${
              root === '.'
                ? 'bg-amber-600 border-amber-500 text-black'
                : 'bg-zinc-900 border-zinc-700 text-zinc-400 hover:border-zinc-500'
            }`}
          >
            ROOT
          </button>
          <button
            onClick={() => onRootChange('public')}
            className={`px-3 py-1 text-[10px] font-bold uppercase border transition-colors ${
              root === 'public'
                ? 'bg-amber-600 border-amber-500 text-black'
                : 'bg-zinc-900 border-zinc-700 text-zinc-400 hover:border-zinc-500'
            }`}
          >
            PUBLIC
          </button>
          <button
            onClick={() => onRootChange('dist')}
            className={`px-3 py-1 text-[10px] font-bold uppercase border transition-colors ${
              root === 'dist'
                ? 'bg-amber-600 border-amber-500 text-black'
                : 'bg-zinc-900 border-zinc-700 text-zinc-400 hover:border-zinc-500'
            }`}
          >
            DIST
          </button>
        </div>
      </header>

      <div className="flex items-center gap-2 px-4 py-2 bg-zinc-900 border-b border-zinc-800">
        <span className="text-amber-600 text-xs font-bold">{root === '.' ? 'ROOT' : root.toUpperCase()}/</span>
        <span className="text-zinc-400 text-xs">{currentPath || '(root)'}</span>
        <div className="flex-1" />
        <button
          onClick={onCreateFolder}
          className="px-2 py-1 text-[9px] font-bold uppercase bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300"
        >
          + FOLDER
        </button>
        <button
          onClick={onCreateFile}
          className="px-2 py-1 text-[9px] font-bold uppercase bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300"
        >
          + FILE
        </button>
        <button
          onClick={onRefresh}
          className="px-2 py-1 text-[9px] font-bold uppercase bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300"
        >
          REFRESH
        </button>
      </div>
    </>
  );
};
