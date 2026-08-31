import { useEffect, useState, useSyncExternalStore } from 'react';
import { Spin } from 'antd';
import { getApiLoadingSnapshot, subscribeToApiLoading } from '../../services/api';

export const LOADING_MESSAGE = 'One sec… pretending this is very complicated 😎';

export function LoadingNotice({ fullPage = false }) {
  return (
    <div
      className="loading-notice"
      role="status"
      aria-live="polite"
      style={{ minHeight: fullPage ? '100vh' : 160 }}
    >
      <Spin size="large" />
      <span>{LOADING_MESSAGE}</span>
    </div>
  );
}

export default function GlobalLoadingIndicator() {
  const activeRequests = useSyncExternalStore(
    subscribeToApiLoading,
    getApiLoadingSnapshot,
    getApiLoadingSnapshot,
  );
  const [visible, setVisible] = useState(false);

  // A short delay prevents a distracting flash for cached or near-instant requests while
  // still making every meaningful wait visible. It also lets several parallel dashboard
  // requests share one calm status surface instead of stacking duplicate messages.
  useEffect(() => {
    if (activeRequests === 0) {
      setVisible(false);
      return undefined;
    }
    const timer = setTimeout(() => setVisible(true), 180);
    return () => clearTimeout(timer);
  }, [activeRequests]);

  if (!visible || activeRequests === 0) return null;

  return (
    <div className="global-loading-indicator" role="status" aria-live="polite">
      <Spin size="small" />
      <span>{LOADING_MESSAGE}</span>
    </div>
  );
}
