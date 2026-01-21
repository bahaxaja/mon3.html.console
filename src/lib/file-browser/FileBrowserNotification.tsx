/**
 * File Browser Feature - Notification Component
 */

import React from 'react';
import { NotificationState } from '../types';

interface Props {
  notification: NotificationState | null;
}

export const FileBrowserNotification: React.FC<Props> = ({ notification }) => {
  if (!notification) return null;

  return (
    <div
      className={`fixed top-4 right-4 z-50 px-4 py-2 text-xs font-bold border ${
        notification.type === 'success'
          ? 'bg-green-950 border-green-700 text-green-400'
          : 'bg-red-950 border-red-700 text-red-400'
      }`}
    >
      {notification.message}
    </div>
  );
};
