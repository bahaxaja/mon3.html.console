/**
 * File Browser Feature - Type Definitions
 * Reusable types for the file browser feature
 */

export interface FileItem {
  name: string;
  type: 'file' | 'directory';
  size: number;
  modified: string;
  extension: string | null;
}

export interface FileContent {
  content: string;
  name: string;
  size: number;
  modified: string;
}

export type RootDirectory = '.' | 'dist' | 'public';

export interface NotificationState {
  message: string;
  type: 'success' | 'error';
}

export interface FileBrowserConfig {
  allowedRoots?: RootDirectory[];
  defaultRoot?: RootDirectory;
  apiBasePath?: string;
  maxFileSize?: number;
}
