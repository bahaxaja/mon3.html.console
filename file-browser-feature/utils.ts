/**
 * File Browser Feature - Utility Functions
 * Helper functions for formatting and file operations
 */

import { FileItem } from './types';

export const formatSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export const formatDate = (iso: string): string => {
  return new Date(iso).toLocaleString();
};

export const getFileIcon = (item: FileItem): string => {
  if (item.type === 'directory') return '📁';
  const ext = item.extension?.toLowerCase();
  if (['json'].includes(ext || '')) return '📋';
  if (['js', 'ts', 'tsx', 'jsx'].includes(ext || '')) return '📜';
  if (['css', 'scss'].includes(ext || '')) return '🎨';
  if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'].includes(ext || '')) return '🖼️';
  if (['md', 'txt'].includes(ext || '')) return '📝';
  return '📄';
};

export const downloadFile = (root: string, currentPath: string, fileName: string): void => {
  const url = `/api/files?root=${root}&dir=${encodeURIComponent(currentPath)}&action=download&file=${encodeURIComponent(fileName)}`;
  window.parent.postMessage(
    { type: 'OPEN_EXTERNAL_URL', data: { url: window.location.origin + url } },
    '*'
  );
};
