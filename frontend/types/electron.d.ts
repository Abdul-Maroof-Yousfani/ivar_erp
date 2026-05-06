/**
 * Type declarations for the Electron preload bridge.
 * Exposed as window.posDesktop when running inside the Electron desktop app.
 *
 * Check if running in Electron: typeof window !== 'undefined' && !!window.posDesktop
 */

interface PosDesktopBridge {
  // App info
  getAppVersion: () => Promise<string>;
  getPlatform: () => Promise<string>;

  // Config
  getConfig: () => Promise<{
    localServicePort: number;
    remoteApiUrl: string;
    offlineMode: boolean;
    syncIntervalMs: number;
  }>;
  setOfflineMode: (enabled: boolean) => Promise<void>;
  setRemoteApiUrl: (url: string) => Promise<void>;

  // Connectivity
  checkConnectivity: () => Promise<{ online: boolean; localServiceReady: boolean }>;

  // Sync status
  getSyncStatus: () => Promise<{
    pendingCount: number;
    lastSyncAt: string | null;
    isSyncing: boolean;
    failedCount: number;
  }>;
  triggerSync: () => Promise<{ triggered: boolean }>;

  // Auth token cache
  saveTokens: (tokens: {
    accessToken: string;
    refreshToken: string;
    terminalToken?: string;
  }) => Promise<void>;
  clearTokens: () => Promise<void>;

  // Window controls
  minimizeWindow: () => void;
  maximizeWindow: () => void;
  closeWindow: () => void;
  isMaximized: () => Promise<boolean>;

  // Events
  onOfflineModeChanged: (cb: (offlineMode: boolean) => void) => () => void;
  onSyncStatusChanged: (cb: (status: { pendingCount: number; isSyncing: boolean }) => void) => () => void;
  onConnectivityChanged: (cb: (online: boolean) => void) => () => void;
}

declare global {
  interface Window {
    /**
     * Available only when running inside the Electron desktop app.
     * Always check: if (window.posDesktop) { ... }
     */
    posDesktop?: PosDesktopBridge;
  }
}

export {};
