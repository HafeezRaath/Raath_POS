// ============================================================
//  hooks/useLazySync.js — Route-Based Lazy Sync Hook
//  Page change pe sirf us page ka data sync hota hai
//  Instant load + Background sync
// ============================================================

import { useEffect, useState, useRef, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { getCollectionsForRoute } from '../syncConfig';
import { cloudSync } from '../cloudSync';

/**
 * useLazySync Hook
 * 
 * Usage:
 *   const { isLoading, progress, syncedCollections, error, status } = useLazySync();
 * 
 * Features:
 *   - Route change pe sirf required collections sync
 *   - Cache-first: Pehle local se data lo, phir cloud se update
 *   - Background sync: Baqi collections silent sync
 *   - Progress tracking
 */
export const useLazySync = (options = {}) => {
  const {
    enableBackgroundSync = true,
    backgroundDelay = 2000,
    onSyncComplete = null,
    onSyncError = null
  } = options;

  const location = useLocation();
  const [syncStatus, setSyncStatus] = useState({
    isLoading: true,
    progress: 0,
    totalCollections: 0,
    syncedCollections: [],
    currentCollection: null,
    error: null,
    isBackgroundSyncing: false
  });

  const abortControllerRef = useRef(null);
  const isMountedRef = useRef(true);
  const lastRouteRef = useRef(null);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  useEffect(() => {
    const pathname = location.pathname;

    if (lastRouteRef.current === pathname) return;
    lastRouteRef.current = pathname;

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();
    const { signal } = abortControllerRef.current;

    const initSync = async () => {
      const collectionsToSync = getCollectionsForRoute(pathname);

      if (!isMountedRef.current || signal.aborted) return;

      setSyncStatus({
        isLoading: true,
        progress: 0,
        totalCollections: collectionsToSync.length,
        syncedCollections: [],
        currentCollection: null,
        error: null,
        isBackgroundSyncing: false
      });

      try {
        // Pehle check karo local cache mein data hai
        const hasLocalData = await checkLocalCache(collectionsToSync);

        if (hasLocalData && isMountedRef.current && !signal.aborted) {
          setSyncStatus(prev => ({
            ...prev,
            isLoading: false,
            progress: 30
          }));
        }

        // Progress callback
        const progressCallback = (completed, total, collectionName) => {
          if (!isMountedRef.current || signal.aborted) return;

          const progress = Math.round((completed / total) * 100);

          setSyncStatus(prev => {
            const newSynced = prev.syncedCollections.includes(collectionName) 
              ? prev.syncedCollections 
              : [...prev.syncedCollections, collectionName];

            return {
              ...prev,
              progress,
              currentCollection: collectionName,
              syncedCollections: newSynced,
              isLoading: completed >= 1 ? false : prev.isLoading
            };
          });
        };

        // 🔧 FIXED: db access — window.db directly storage instance hai
        const dbInstance = window.db || (window.db?.storage);

        if (dbInstance && typeof dbInstance.syncCollectionsFromCloud === 'function') {
          await dbInstance.syncCollectionsFromCloud(collectionsToSync, progressCallback);
        } else {
          await cloudSync.syncCollections(collectionsToSync, 'high', progressCallback);
        }

        if (!isMountedRef.current || signal.aborted) return;

        setSyncStatus(prev => ({
          ...prev,
          isLoading: false,
          progress: 100,
          currentCollection: null
        }));

        if (onSyncComplete) {
          onSyncComplete({ collections: collectionsToSync, route: pathname });
        }

        // Background sync
        if (enableBackgroundSync && !cloudSync.isFullSyncComplete) {
          setTimeout(() => {
            if (isMountedRef.current && !signal.aborted) {
              setSyncStatus(prev => ({ ...prev, isBackgroundSyncing: true }));

              const bgDb = window.db || (window.db?.storage);
              if (bgDb && typeof bgDb.startBackgroundSync === 'function') {
                bgDb.startBackgroundSync();
              } else {
                cloudSync.syncRemainingInBackground();
              }
            }
          }, backgroundDelay);
        }

      } catch (error) {
        if (!isMountedRef.current || signal.aborted) return;

        console.error('[useLazySync] Sync failed:', error);
        setSyncStatus(prev => ({
          ...prev,
          isLoading: false,
          error: error.message,
          progress: 0
        }));

        if (onSyncError) onSyncError(error);
      }
    };

    initSync();

  }, [location.pathname, enableBackgroundSync, backgroundDelay, onSyncComplete, onSyncError]);

  const isCollectionReady = useCallback((collectionName) => {
    return cloudSync.isCollectionSynced(collectionName);
  }, []);

  const forceSync = useCallback(async (collectionNames) => {
    setSyncStatus(prev => ({ ...prev, isLoading: true }));
    try {
      const dbInstance = window.db || (window.db?.storage);
      if (dbInstance && typeof dbInstance.syncCollectionsFromCloud === 'function') {
        await dbInstance.syncCollectionsFromCloud(collectionNames);
      } else {
        await cloudSync.syncCollections(collectionNames, 'high');
      }
      setSyncStatus(prev => ({ ...prev, isLoading: false }));
    } catch (e) {
      setSyncStatus(prev => ({ ...prev, isLoading: false, error: e.message }));
    }
  }, []);

  return {
    ...syncStatus,
    isCollectionReady,
    forceSync,
    status: cloudSync.getStatus()
  };
};

// ==================== HELPER: Check Local Cache ====================
async function checkLocalCache(collectionNames) {
  try {
    const dbInstance = window.db || (window.db?.storage);
    if (!dbInstance) return false;

    for (const collectionName of collectionNames) {
      try {
        // Try different method signatures
        let data = null;

        if (typeof dbInstance.getAll === 'function') {
          data = await dbInstance.getAll(collectionName, 1);
        }

        if (data && data.length > 0) return true;
      } catch (e) {
        // Ignore
      }
    }
    return false;
  } catch (e) {
    return false;
  }
}

// ==================== useSyncProgress Hook ====================
export const useSyncProgress = () => {
  const [progress, setProgress] = useState({
    synced: 0,
    total: 0,
    percentage: 0,
    isComplete: false
  });

  useEffect(() => {
    const handleCollectionSynced = (e) => {
      const status = cloudSync.getStatus();
      const synced = status.syncedCount || 0;
      const total = status.totalCollections || 1;
      setProgress({
        synced,
        total,
        percentage: Math.round((synced / total) * 100),
        isComplete: status.isFullSyncComplete,
        lastCollection: e.detail?.collectionName
      });
    };

    const handleFullSyncComplete = () => {
      const status = cloudSync.getStatus();
      setProgress({
        synced: status.totalCollections || 0,
        total: status.totalCollections || 0,
        percentage: 100,
        isComplete: true
      });
    };

    window.addEventListener('cloudsync_collection_synced', handleCollectionSynced);
    window.addEventListener('cloudsync_full_sync_complete', handleFullSyncComplete);

    return () => {
      window.removeEventListener('cloudsync_collection_synced', handleCollectionSynced);
      window.removeEventListener('cloudsync_full_sync_complete', handleFullSyncComplete);
    };
  }, []);

  return progress;
};

export default useLazySync;