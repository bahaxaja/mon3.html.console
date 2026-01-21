/**
 * File Browser Feature - Public Exports
 * Use these exports to integrate the file browser into other projects
 */

// Main component
export { FileBrowserContainer } from './FileBrowserContainer';

// Sub-components (for custom layouts)
export { FileBrowserNotification } from './components/FileBrowserNotification';
export { FileBrowserHeader } from './components/FileBrowserHeader';
export { FileList } from './components/FileList';
export { FileViewer } from './components/FileViewer';
export { CreateDialog, RenameDialog, DeleteDialog } from './components/Dialogs';

// Hooks
export { useFileBrowserState, useFileOperations } from './hooks';

// Utilities
export { formatSize, formatDate, getFileIcon, downloadFile } from './utils';

// Types
export type { FileItem, FileContent, RootDirectory, NotificationState, FileBrowserConfig } from './types';
