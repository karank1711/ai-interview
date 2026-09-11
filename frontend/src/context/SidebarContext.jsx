import { createContext, useContext, useEffect, useState } from 'react';

const STORAGE_KEY = 'interviewiq-sidebar-open';
const SidebarContext = createContext(null);

function readStoredOpen() {
  try {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    if (stored === 'true') return true;
    if (stored === 'false') return false;
  } catch {
    /* ignore */
  }
  return typeof window !== 'undefined' ? window.innerWidth >= 1024 : true;
}

export function SidebarProvider({ children }) {
  const [open, setOpen] = useState(readStoredOpen);

  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, String(open));
    } catch {
      /* ignore */
    }
  }, [open]);

  const toggle = () => setOpen((current) => !current);
  const close = () => setOpen(false);
  const value = { open, setOpen, toggle, close };

  return <SidebarContext.Provider value={value}>{children}</SidebarContext.Provider>;
}

export function useSidebar() {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error('useSidebar must be used within SidebarProvider');
  }
  return context;
}
