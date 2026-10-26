import React, { useState, useEffect } from 'react';
import { WifiOff, RefreshCw } from 'lucide-react';

export const OfflineBanner: React.FC = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (isOnline) return null;

  return (
    <div className="bg-amber-500 text-slate-900 px-4 py-2 text-xs font-semibold flex items-center justify-between shadow-sm animate-fade-in z-50 sticky top-16">
      <div className="flex items-center space-x-2">
        <WifiOff className="w-4 h-4 text-slate-900" />
        <span>You are currently offline. Displaying cached timetables & directory schedules.</span>
      </div>
      <button
        onClick={() => window.location.reload()}
        className="px-2.5 py-1 rounded-lg bg-slate-900 text-white text-[11px] font-bold flex items-center space-x-1 hover:bg-slate-800 transition"
      >
        <RefreshCw className="w-3 h-3" />
        <span>Retry</span>
      </button>
    </div>
  );
};
