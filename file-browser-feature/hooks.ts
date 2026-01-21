/**
 * File Browser Feature - Custom Hooks
 * Reusable logic for file operations
 */

import { useCallback, useState } from 'react';
import { FileItem, FileContent, RootDirectory, NotificationState } from './types';

export function useFileBrowserState(defaultRoot: RootDirectory = 'public') {
  const [root, setRoot] = useState<RootDirectory>(defaultRoot);
  const [currentPath, setCurrentPath] = useState('');
  const [items, setItems] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<FileContent | null>(null);
  const [notification, setNotification] = useState<NotificationState | null>(null);

  const showNotification = useCallback((message: string, type: 'success' | 'error') => {
    setNotification({ message, type });
    const timeout = setTimeout(() => setNotification(null), 3000);
    return () => clearTimeout(timeout);
  }, []);

  return {
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
  };
}

export function useFileOperations(
  root: RootDirectory,
  currentPath: string,
  showNotification: (msg: string, type: 'success' | 'error') => void,
  onSuccess?: () => void
) {
  const loadDirectory = useCallback(
    async (setItems: (items: FileItem[]) => void, setLoading: (loading: boolean) => void, setError: (error: string | null) => void) => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/files?root=${root}&dir=${encodeURIComponent(currentPath)}&action=list`);
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        setItems(data.items);
      } catch (err: any) {
        setError(err.message);
        showNotification(err.message, 'error');
      } finally {
        setLoading(false);
      }
    },
    [root, currentPath, showNotification]
  );

  const openFile = useCallback(
    async (
      file: FileItem,
      setCurrentPath: (path: string) => void,
      setSelectedFile: (file: FileContent | null) => void
    ) => {
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
      } catch (err: any) {
        showNotification(err.message, 'error');
      }
    },
    [root, currentPath, showNotification]
  );

  const saveFile = useCallback(
    async (selectedFile: FileContent, editContent: string, setSelectedFile: (file: FileContent) => void) => {
      if (!selectedFile) return;
      try {
        const res = await fetch('/api/files', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            root,
            dir: currentPath,
            action: 'save',
            name: selectedFile.name,
            content: editContent,
          }),
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        showNotification('File saved', 'success');
        setSelectedFile({ ...selectedFile, content: editContent });
        onSuccess?.();
      } catch (err: any) {
        showNotification(err.message, 'error');
      }
    },
    [root, currentPath, showNotification, onSuccess]
  );

  const createNew = useCallback(
    async (
      type: 'file' | 'folder',
      name: string,
      onSuccess: () => void
    ) => {
      if (!name.trim()) return;
      try {
        const res = await fetch('/api/files', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            root,
            dir: currentPath,
            action: type === 'folder' ? 'create-folder' : 'create-file',
            name: name.trim(),
            content: '',
          }),
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        showNotification(data.message, 'success');
        onSuccess();
      } catch (err: any) {
        showNotification(err.message, 'error');
      }
    },
    [root, currentPath, showNotification]
  );

  const rename = useCallback(
    async (oldName: string, newName: string, onSuccess: () => void) => {
      if (!newName.trim()) return;
      try {
        const res = await fetch('/api/files', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            root,
            dir: currentPath,
            action: 'rename',
            name: oldName,
            newName: newName.trim(),
          }),
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        showNotification(data.message, 'success');
        onSuccess();
      } catch (err: any) {
        showNotification(err.message, 'error');
      }
    },
    [root, currentPath, showNotification]
  );

  const deleteItem = useCallback(
    async (name: string, onSuccess: () => void) => {
      try {
        const res = await fetch('/api/files', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            root,
            dir: currentPath,
            action: 'delete',
            name,
          }),
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        showNotification(data.message, 'success');
        onSuccess();
      } catch (err: any) {
        showNotification(err.message, 'error');
      }
    },
    [root, currentPath, showNotification]
  );

  return {
    loadDirectory,
    openFile,
    saveFile,
    createNew,
    rename,
    deleteItem,
  };
}
