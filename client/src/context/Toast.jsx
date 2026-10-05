import { createContext, useCallback, useContext, useRef, useState } from 'react';

const ToastContext = createContext(() => {});

// toast('Saved') or toast('Something failed', 'bad')
export const useToast = () => useContext(ToastContext);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const nextId = useRef(1);

  const toast = useCallback((message, tone = 'good') => {
    const id = nextId.current++;
    setToasts((list) => [...list.slice(-2), { id, message, tone }]);
    setTimeout(() => setToasts((list) => list.filter((item) => item.id !== id)), tone === 'bad' ? 6000 : 3500);
  }, []);

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((item) => (
          <div key={item.id} className={`toast ${item.tone}`}>
            {item.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

// Runs a request, shows the result as a toast, and reports whether it worked.
export function useSubmit() {
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  const run = useCallback(
    async (action, successMessage) => {
      setBusy(true);
      try {
        const result = await action();
        if (successMessage) toast(successMessage);
        return result ?? true;
      } catch (err) {
        toast(err.message, 'bad');
        return null;
      } finally {
        setBusy(false);
      }
    },
    [toast]
  );

  return { busy, run };
}
