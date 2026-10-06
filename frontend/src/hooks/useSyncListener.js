// ============================================================
//  frontend/src/hooks/useSyncListener.js
//  Live data refresh listener (No-op / window focus trigger)
// ============================================================

import { useEffect } from 'react';

export function useSyncListener(callback) {
  useEffect(() => {
    if (typeof callback !== 'function') return;

    // Refresh on window focus or online event
    const handleOnline = () => {
      try { callback(); } catch (_) {}
    };

    window.addEventListener('online', handleOnline);
    return () => {
      window.removeEventListener('online', handleOnline);
    };
  }, [callback]);
}

export default useSyncListener;
