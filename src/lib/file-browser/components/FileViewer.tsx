/**
 * File Browser Feature - File Viewer Component
 */

import React from 'react';
import { FileContent, RootDirectory } from '../types';
import { formatSize, formatDate, downloadFile } from '../utils';

interface Props {
  selectedFile: FileContent | null;
  isEditing: boolean;
  editContent: string;
  root: RootDirectory;
  currentPath: string;
  onEditChange: (content: string) => void;
  onEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
  onDownload: () => void;
}

export const FileViewer: React.FC<Props> = ({
  selectedFile,
  isEditing,
  editContent,
  root,
  currentPath,
  onEditChange,
  onEdit,
  onSave,
  onCancel,
  onDownload,
}) => {
  return (
    <div className="flex-1 flex flex-col bg-zinc-950">
      {selectedFile ? (
        <>
          <div className="flex items-center gap-2 px-4 py-2 bg-zinc-900 border-b border-zinc-800">
            <span className="text-amber-500 font-bold text-xs">{selectedFile.name}</span>
            <span className="text-zinc-600 text-[10px]">{formatSize(selectedFile.size)}</span>
            <span className="text-zinc-600 text-[10px]">{formatDate(selectedFile.modified)}</span>
            <div className="flex-1" />
            {isEditing ? (
              <>
                <button
                  onClick={onSave}
                  className="px-3 py-1 text-[9px] font-bold uppercase bg-green-700 hover:bg-green-600 text-white"
                >
                  SAVE
                </button>
                <button
                  onClick={onCancel}
                  className="px-3 py-1 text-[9px] font-bold uppercase bg-zinc-700 hover:bg-zinc-600 text-zinc-200"
                >
                  CANCEL
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={onDownload}
                  className="px-3 py-1 text-[9px] font-bold uppercase bg-blue-700 hover:bg-blue-600 text-white"
                >
                  DOWNLOAD
                </button>
                <button
                  onClick={onEdit}
                  className="px-3 py-1 text-[9px] font-bold uppercase bg-amber-600 hover:bg-amber-500 text-black"
                >
                  EDIT
                </button>
              </>
            )}
          </div>
          <div className="flex-1 overflow-auto p-4">
            {isEditing ? (
              <textarea
                value={editContent}
                onChange={(e) => onEditChange(e.target.value)}
                className="w-full h-full bg-black border border-zinc-800 text-zinc-300 text-xs p-3 font-mono resize-none focus:outline-none focus:border-amber-600"
                spellCheck={false}
              />
            ) : (
              <pre className="text-xs text-zinc-400 whitespace-pre-wrap break-all">
                {selectedFile.content}
              </pre>
            )}
          </div>
        </>
      ) : (
        <div className="flex-1 flex items-center justify-center text-zinc-600 text-xs">
          Select a file to view
        </div>
      )}
    </div>
  );
};
