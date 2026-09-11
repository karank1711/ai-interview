import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircleIcon, ExclamationTriangleIcon, XMarkIcon } from '@heroicons/react/24/solid';

const PopupContext = createContext(null);

export function usePopup() {
  const context = useContext(PopupContext);
  if (!context) {
    throw new Error('usePopup must be used within PopupProvider');
  }
  return context;
}

export function PopupProvider({ children }) {
  const [popup, setPopup] = useState(null);
  const popupIdRef = useRef(0);
  const timerRef = useRef(null);

  const hidePopup = useCallback(() => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setPopup(null);
  }, []);

  const actionRef = useRef({ onConfirm: null, onCancel: null });

  const showPopup = useCallback(({
    type = 'success',
    title,
    message,
    autoCloseMs,
    confirmLabel,
    cancelLabel,
    onConfirm,
    onCancel,
  } = {}) => {
    const nextType = ['error', 'confirm', 'status'].includes(type) ? type : 'success';
    const duration = autoCloseMs ?? (nextType === 'success' || nextType === 'status' ? 3200 : 0);
    const id = ++popupIdRef.current;
    actionRef.current = { onConfirm: onConfirm || null, onCancel: onCancel || null };
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setPopup({
      id,
      type: nextType,
      title: title || (nextType === 'error' ? 'Something went wrong' : nextType === 'confirm' ? 'Please confirm' : 'Success'),
      message: message || '',
      confirmLabel: confirmLabel || (nextType === 'confirm' ? 'Confirm' : nextType === 'error' ? 'Try again' : 'Continue'),
      cancelLabel: cancelLabel || 'Cancel',
    });
    if (duration > 0 && nextType !== 'confirm') {
      timerRef.current = window.setTimeout(() => {
        setPopup((current) => (current?.id === id ? null : current));
        timerRef.current = null;
      }, duration);
    }
  }, []);

  const value = useMemo(() => ({ showPopup, hidePopup, popup }), [showPopup, hidePopup, popup]);

  return (
    <PopupContext.Provider value={value}>
      {children}
      <AppPopup
        popup={popup}
        onClose={() => {
          actionRef.current.onCancel?.();
          hidePopup();
        }}
        onConfirm={async () => {
          const confirm = actionRef.current.onConfirm;
          hidePopup();
          if (confirm) await confirm();
        }}
      />
    </PopupContext.Provider>
  );
}

function AppPopup({ popup, onClose, onConfirm }) {
  const isError = popup?.type === 'error';
  const isConfirm = popup?.type === 'confirm';
  const isStatus = popup?.type === 'status';

  return (
    <AnimatePresence>
      {popup && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-center justify-center px-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <button
            type="button"
            aria-label="Close popup"
            className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="app-popup-title"
            style={{ perspective: 1200 }}
            className="relative w-full max-w-md"
            initial={{ opacity: 0, y: 40, rotateX: 28, scale: 0.86 }}
            animate={{ opacity: 1, y: 0, rotateX: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, rotateX: -16, scale: 0.92 }}
            transition={{ type: 'spring', stiffness: 280, damping: 22 }}
          >
            <div
              className={`relative overflow-hidden rounded-3xl border p-6 shadow-[0_24px_60px_rgba(15,23,42,0.35)] ${
                isError
                  ? 'border-red-200 bg-gradient-to-br from-white via-red-50 to-orange-50 dark:border-red-800 dark:from-gray-900 dark:via-red-950 dark:to-gray-900'
                  : 'border-blue-200 bg-gradient-to-br from-white via-blue-50 to-purple-50 dark:border-blue-800 dark:from-gray-900 dark:via-indigo-950 dark:to-gray-900'
              }`}
            >
              <div
                className={`pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full blur-2xl ${
                  isError ? 'bg-red-400/30' : 'bg-purple-400/30'
                }`}
              />
              <button
                type="button"
                onClick={onClose}
                className="absolute right-3 top-3 rounded-full p-1 text-gray-400 hover:bg-white/60 hover:text-gray-700 dark:hover:bg-gray-800"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
              <div className="relative flex items-start gap-4">
                <motion.div
                  className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-white shadow-lg ${
                    isError
                      ? 'bg-gradient-to-br from-red-500 to-orange-500'
                      : 'bg-gradient-to-br from-blue-500 to-purple-600'
                  }`}
                  initial={{ rotateY: -90, scale: 0.6 }}
                  animate={{ rotateY: 0, scale: 1 }}
                  transition={{ type: 'spring', stiffness: 260, damping: 16, delay: 0.08 }}
                >
                  {isError ? (
                    <ExclamationTriangleIcon className="h-8 w-8" />
                  ) : (
                    <CheckCircleIcon className="h-8 w-8" />
                  )}
                </motion.div>
                <div className="pr-6">
                  <h3 id="app-popup-title" className="text-xl font-bold text-gray-900 dark:text-white">
                    {popup.title}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-gray-600 dark:text-gray-300">
                    {popup.message}
                  </p>
                </div>
              </div>
              <div className="mt-6 flex justify-end gap-3">
                {isConfirm && (
                  <button
                    type="button"
                    onClick={onClose}
                    className="rounded-xl px-4 py-2 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-white/70 dark:hover:bg-gray-800"
                  >
                    {popup.cancelLabel}
                  </button>
                )}
                <button
                  type="button"
                  onClick={isConfirm ? onConfirm : onClose}
                  className={`rounded-xl px-4 py-2 text-sm font-semibold text-white shadow-md ${
                    isError || isConfirm
                      ? 'bg-gradient-to-r from-red-500 to-orange-500'
                      : 'bg-gradient-to-r from-blue-500 to-purple-600'
                  }`}
                >
                  {popup.confirmLabel}
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default AppPopup;
