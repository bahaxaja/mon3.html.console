//AGENT RULE:
//ALWAYS READ THE .nomodify FILE
//BEFORE EDITING AND DO NOT EDIT
//ANY FILES LISTED IN .nomodify

import React from 'react';
import { initBundleWithMeta } from '../../lib/initBundleWmeta';

/**
 * BundleControls component - Renders controls for managing the bundle
 * including initialization and metadata actions.
 */
export function BundleControls(props) {
  const { wallet, connection, cachePath, sendTransaction, addLog } = props;

  /**
   * handleInitWithMeta - Handles the initialization of the bundle with metadata.
   * Calls the initBundleWithMeta function and provides user feedback via addLog.
   */
  const handleInitWithMeta = async () => {
    try {
      addLog('Starting bundle init (with metadata)...', 'info');
      await initBundleWithMeta({
        wallet,
        connection,
        cachePath,
        sendTransaction,
        addLog
      });
    } catch (err: any) {
      addLog(`Init w/meta failed: ${err?.message ?? err}`, 'error');
    }
  };

  return (
    <div className="bundle-controls">
      {/* Existing controls... */}

      {/* Button to initialize the bundle and create Metaplex metadata */}
      <button
        className="btn init-bundle-meta"
        onClick={handleInitWithMeta}
        title="Initialize bundle and create Metaplex metadata"
      >
        INIT W META
      </button>

      {/* Other existing controls... */}
    </div>
  );
}