/**
 * Toast notification system — lightweight global error/success feedback.
 * Usage: import { useToast, ToastContainer } from '../shared/Toast.jsx'
 */
import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';

const ToastCtx = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const add = useCallback((message, type = 'error', durationMs = 5000) => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, message, type }]);
    if (durationMs > 0) {
      setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), durationMs);
    }
    return id;
  }, []);

  const remove = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return (
    <ToastCtx.Provider value={{ add, remove }}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={remove} />
    </ToastCtx.Provider>
  );
}

export function useToast() {
  return useContext(ToastCtx);
}

const TYPE_STYLES = {
  error:   { bg: 'rgba(255,92,92,0.95)',   border: '#ff5c5c', icon: '✗' },
  success: { bg: 'rgba(61,214,140,0.95)',  border: '#3dd68c', icon: '✓' },
  warning: { bg: 'rgba(245,166,35,0.95)',  border: '#f5a623', icon: '⚠' },
  info:    { bg: 'rgba(86,180,245,0.95)',  border: '#56b4f5', icon: 'ℹ' },
};

function ToastContainer({ toasts, onDismiss }) {
  if (toasts.length === 0) return null;
  return (
    <div style={{
      position: 'fixed', bottom: 24, right: 24,
      display: 'flex', flexDirection: 'column', gap: 8,
      zIndex: 9999, maxWidth: 380,
    }}>
      {toasts.map(t => {
        const s = TYPE_STYLES[t.type] || TYPE_STYLES.info;
        return (
          <div key={t.id} style={{
            display: 'flex', alignItems: 'flex-start', gap: 10,
            padding: '10px 14px',
            background: 'var(--surface)',
            border: `1px solid ${s.border}`,
            borderLeft: `4px solid ${s.border}`,
            borderRadius: 8,
            boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
            fontSize: 13,
            animation: 'slideIn 0.2s ease',
          }}>
            <span style={{ fontWeight: 700, color: s.border, flexShrink: 0 }}>{s.icon}</span>
            <span style={{ flex: 1, color: 'var(--text)', lineHeight: 1.5 }}>{t.message}</span>
            <button onClick={() => onDismiss(t.id)} style={{
              background: 'none', border: 'none', color: 'var(--text-muted)',
              cursor: 'pointer', fontSize: 14, padding: 0, flexShrink: 0,
            }}>×</button>
          </div>
        );
      })}
    </div>
  );
}
