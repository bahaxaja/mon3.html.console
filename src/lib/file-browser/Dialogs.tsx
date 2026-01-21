/**
 * File Browser Feature - Dialog Components
 */

import React from 'react';
import { FileItem } from '../types';

interface CreateDialogProps {
  isOpen: boolean;
  type: 'file' | 'folder' | null;
  name: string;
  onNameChange: (name: string) => void;
  onCreate: () => void;
  onCancel: () => void;
}

export const CreateDialog: React.FC<CreateDialogProps> = ({
  isOpen,
  type,
  name,
  onNameChange,
  onCreate,
  onCancel,
}) => {
  if (!isOpen || !type) return null;

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
      <div className="bg-zinc-900 border border-zinc-700 p-4 w-80">
        <h3 className="text-amber-500 font-bold text-xs uppercase mb-3">
          Create New {type === 'folder' ? 'Folder' : 'File'}
        </h3>
        <input
          type="text"
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          placeholder={type === 'folder' ? 'folder-name' : 'filename.json'}
          className="w-full bg-black border border-zinc-700 text-zinc-300 text-xs p-2 mb-3 focus:outline-none focus:border-amber-600"
          autoFocus
          onKeyDown={(e) => e.key === 'Enter' && onCreate()}
        />
        <div className="flex gap-2 justify-end">
          <button
            onClick={onCancel}
            className="px-3 py-1 text-[9px] font-bold uppercase bg-zinc-700 hover:bg-zinc-600 text-zinc-200"
          >
            CANCEL
          </button>
          <button
            onClick={onCreate}
            className="px-3 py-1 text-[9px] font-bold uppercase bg-amber-600 hover:bg-amber-500 text-black"
          >
            CREATE
          </button>
        </div>
      </div>
    </div>
  );
};

interface RenameDialogProps {
  isOpen: boolean;
  name: string;
  onNameChange: (name: string) => void;
  onRename: () => void;
  onCancel: () => void;
}

export const RenameDialog: React.FC<RenameDialogProps> = ({
  isOpen,
  name,
  onNameChange,
  onRename,
  onCancel,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
      <div className="bg-zinc-900 border border-zinc-700 p-4 w-80">
        <h3 className="text-amber-500 font-bold text-xs uppercase mb-3">Rename</h3>
        <input
          type="text"
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          className="w-full bg-black border border-zinc-700 text-zinc-300 text-xs p-2 mb-3 focus:outline-none focus:border-amber-600"
          autoFocus
          onKeyDown={(e) => e.key === 'Enter' && onRename()}
        />
        <div className="flex gap-2 justify-end">
          <button
            onClick={onCancel}
            className="px-3 py-1 text-[9px] font-bold uppercase bg-zinc-700 hover:bg-zinc-600 text-zinc-200"
          >
            CANCEL
          </button>
          <button
            onClick={onRename}
            className="px-3 py-1 text-[9px] font-bold uppercase bg-amber-600 hover:bg-amber-500 text-black"
          >
            RENAME
          </button>
        </div>
      </div>
    </div>
  );
};

interface DeleteDialogProps {
  isOpen: boolean;
  item: FileItem | null;
  onDelete: () => void;
  onCancel: () => void;
}

export const DeleteDialog: React.FC<DeleteDialogProps> = ({
  isOpen,
  item,
  onDelete,
  onCancel,
}) => {
  if (!isOpen || !item) return null;

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
      <div className="bg-zinc-900 border border-red-800 p-4 w-80">
        <h3 className="text-red-500 font-bold text-xs uppercase mb-3">Confirm Delete</h3>
        <p className="text-zinc-400 text-xs mb-4">
          Are you sure you want to delete <span className="text-white">{item.name}</span>?
          {item.type === 'directory' && ' This will delete all contents.'}
        </p>
        <div className="flex gap-2 justify-end">
          <button
            onClick={onCancel}
            className="px-3 py-1 text-[9px] font-bold uppercase bg-zinc-700 hover:bg-zinc-600 text-zinc-200"
          >
            CANCEL
          </button>
          <button
            onClick={onDelete}
            className="px-3 py-1 text-[9px] font-bold uppercase bg-red-700 hover:bg-red-600 text-white"
          >
            DELETE
          </button>
        </div>
      </div>
    </div>
  );
};
