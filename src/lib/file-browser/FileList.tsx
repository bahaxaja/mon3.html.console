/**
 * File Browser Feature - File List Component
 */

import React from 'react';
import { FileItem, FileContent } from '../types';
import { getFileIcon, formatSize } from '../utils';

interface Props {
  items: FileItem[];
  selectedFile: FileContent | null;
  loading: boolean;
  error: string | null;
  currentPath: string;
  onFileClick: (file: FileItem) => void;
  onGoUp: () => void;
  onRename: (item: FileItem) => void;
  onDelete: (item: FileItem) => void;
}

export const FileList: React.FC<Props> = ({
  items,
  selectedFile,
  loading,
  error,
  currentPath,
  onFileClick,
  onGoUp,
  onRename,
  onDelete,
}) => {
  return (
    <div className="w-1/3 min-w-[280px] max-w-[400px] border-r border-zinc-800 flex flex-col">
      {currentPath && (
        <button
          onClick={onGoUp}
          className="flex items-center gap-2 px-4 py-2 text-xs text-amber-500 hover:bg-zinc-900 border-b border-zinc-800"
        >
          <span>📂</span>
          <span>..</span>
        </button>
      )}

      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="p-4 text-xs text-zinc-500">Loading...</div>
        ) : error ? (
          <div className="p-4 text-xs text-red-500">{error}</div>
        ) : items.length === 0 ? (
          <div className="p-4 text-xs text-zinc-500">Empty directory</div>
        ) : (
          items.map((item) => (
            <div
              key={item.name}
              className={`flex items-center gap-2 px-4 py-2 text-xs cursor-pointer hover:bg-zinc-900 border-b border-zinc-900 ${
                selectedFile?.name === item.name ? 'bg-zinc-800' : ''
              }`}
              onClick={() => onFileClick(item)}
            >
              <span>{getFileIcon(item)}</span>
              <span
                className={`flex-1 truncate ${
                  item.type === 'directory' ? 'text-amber-500' : 'text-zinc-300'
                }`}
              >
                {item.name}
              </span>
              <span className="text-zinc-600 text-[10px]">
                {item.type === 'file' ? formatSize(item.size) : ''}
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onRename(item);
                }}
                className="px-1 text-zinc-600 hover:text-zinc-300"
                title="Rename"
              >
                ✏️
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(item);
                }}
                className="px-1 text-zinc-600 hover:text-red-500"
                title="Delete"
              >
                🗑️
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
