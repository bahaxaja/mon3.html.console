/**
 * File Browser Feature - Main Container Component
 * Fully modular and reusable file browser implementation
 */

'use client';

import React, { useEffect } from 'react';
import { FileItem } from './types';
import { useFileBrowserState, useFileOperations } from './hooks';
import { downloadFile } from './utils';
import { FileBrowserNotification } from './components/FileBrowserNotification';
import { FileBrowserHeader } from './components/FileBrowserHeader';
import { FileList } from './components/FileList';
import { FileViewer } from './components/FileViewer';
import { CreateDialog, RenameDialog, DeleteDialog } from './components/Dialogs';

interface FileBrowserContainerProps {
  backUrl?: string;
  showNavigation?: boolean;
  defaultRoot?: '.' | 'dist' | 'public';
}

export const FileBrowserContainer: React.FC<FileBrowserContainerProps> = ({
  backUrl = '/',
  showNavigation = true,
  defaultRoot = 'public',
}) => {
  const {
    root,
    setRoot,
    currentPath,
    setCurrentPath,
    items,
    setItems,
    loading,
    setLoading,
    error,
    setError,
    selectedFile,
    setSelectedFile,
    notification,
    showNotification,
  } = useFileBrowserState(defaultRoot);

  const { loadDirectory, openFile, saveFile, createNew, rename, deleteItem } = useFileOperations(
    root,
    currentPath,
    showNotification
  );

  // Dialog states
  const [showNewDialog, setShowNewDialog] = React.useState<'file' | 'folder' | null>(null);
  const [newName, setNewName] = React.useState('');
  const [renameItem, setRenameItem] = React.useState<FileItem | null>(null);
  const [renameName, setRenameName] = React.useState('');
  const [confirmDelete, setConfirmDelete] = React.useState<FileItem | null>(null);
  const [editContent, setEditContent] = React.useState('');
  const [isEditing, setIsEditing] = React.useState(false);

  // Load directory on path/root change
  useEffect(() => {
    loadDirectory(setItems, setLoading, setError);
  }, [root, currentPath, loadDirectory, setItems, setLoading, setError]);

  const handleRootChange = (newRoot: '.' | 'dist' | 'public') => {
    setRoot(newRoot);
    setCurrentPath('');
    setSelectedFile(null);
  };

  const handleGoUp = () => {
    const parts = currentPath.split('/').filter(Boolean);
    parts.pop();
    setCurrentPath(parts.join('/'));
    setSelectedFile(null);
  };

  const handleOpenFile = (file: FileItem) => {
    openFile(file, setCurrentPath, setSelectedFile);
    if (file.type === 'file') {
      setEditContent('');
    }
  };

  const handleFileClick = async (file: FileItem) => {
    if (file.type === 'directory') {
      setCurrentPath(currentPath ? `${currentPath}/${file.name}` : file.name);
      setSelectedFile(null);
      return;
    }

    try {
      const res = await fetch(
        `/api/files?root=${root}&dir=${encodeURIComponent(currentPath)}&action=read&file=${encodeURIComponent(file.name)}`
      );
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setSelectedFile(data);
      setEditContent(data.content);
      setIsEditing(false);
    } catch (err: any) {
      showNotification(err.message, 'error');
    }
  };

  const handleSaveFile = async () => {
    if (!selectedFile) return;
    await saveFile(selectedFile, editContent, (updated) => {
      setSelectedFile(updated);
      setIsEditing(false);
    });
  };

  const handleCreateNew = async () => {
    await createNew(showNewDialog as 'file' | 'folder', newName, () => {
      setShowNewDialog(null);
      setNewName('');
      loadDirectory(setItems, setLoading, setError);
    });
  };

  const handleRename = async () => {
    if (!renameItem) return;
    await rename(renameItem.name, renameName, () => {
      setRenameItem(null);
      setRenameName('');
      if (selectedFile?.name === renameItem.name) {
        setSelectedFile(null);
      }
      loadDirectory(setItems, setLoading, setError);
    });
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    await deleteItem(confirmDelete.name, () => {
      setConfirmDelete(null);
      if (selectedFile?.name === confirmDelete.name) {
        setSelectedFile(null);
      }
      loadDirectory(setItems, setLoading, setError);
    });
  };

  return (
    <div className="min-h-screen bg-black text-zinc-300 font-mono flex flex-col">
      <FileBrowserNotification notification={notification} />

      <FileBrowserHeader
        root={root}
        currentPath={currentPath}
        onRootChange={handleRootChange}
        onCreateFolder={() => setShowNewDialog('folder')}
        onCreateFile={() => setShowNewDialog('file')}
        onRefresh={() => loadDirectory(setItems, setLoading, setError)}
        backUrl={backUrl}
        showNavigation={showNavigation}
      />

      <div className="flex flex-1 overflow-hidden">
        <FileList
          items={items}
          selectedFile={selectedFile}
          loading={loading}
          error={error}
          currentPath={currentPath}
          onFileClick={handleFileClick}
          onGoUp={handleGoUp}
          onRename={(item) => {
            setRenameItem(item);
            setRenameName(item.name);
          }}
          onDelete={(item) => setConfirmDelete(item)}
        />

        <FileViewer
          selectedFile={selectedFile}
          isEditing={isEditing}
          editContent={editContent}
          root={root}
          currentPath={currentPath}
          onEditChange={setEditContent}
          onEdit={() => setIsEditing(true)}
          onSave={handleSaveFile}
          onCancel={() => {
            setIsEditing(false);
            setEditContent(selectedFile?.content || '');
          }}
          onDownload={() => {
            if (selectedFile) {
              downloadFile(root, currentPath, selectedFile.name);
            }
          }}
        />
      </div>

      <CreateDialog
        isOpen={showNewDialog !== null}
        type={showNewDialog}
        name={newName}
        onNameChange={setNewName}
        onCreate={handleCreateNew}
        onCancel={() => {
          setShowNewDialog(null);
          setNewName('');
        }}
      />

      <RenameDialog
        isOpen={renameItem !== null}
        name={renameName}
        onNameChange={setRenameName}
        onRename={handleRename}
        onCancel={() => {
          setRenameItem(null);
          setRenameName('');
        }}
      />

      <DeleteDialog
        isOpen={confirmDelete !== null}
        item={confirmDelete}
        onDelete={handleDelete}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
};
