import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckIcon, ChevronDownIcon } from '@heroicons/react/24/outline';

function normalizeOptions(options) {
  return (options || []).map((option) => (
    typeof option === 'object'
      ? { value: String(option.value), label: option.label }
      : { value: String(option), label: String(option) }
  ));
}

function menuPlacement(triggerRect) {
  const gap = 6;
  const maxMenu = 240;
  const pad = 8;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const width = Math.min(Math.max(triggerRect.width, 140), vw - pad * 2);
  const left = Math.min(Math.max(pad, triggerRect.left), vw - width - pad);
  const spaceBelow = vh - triggerRect.bottom - gap - pad;
  const spaceAbove = triggerRect.top - gap - pad;
  const openUp = spaceBelow < 132 && spaceAbove > spaceBelow;
  const maxHeight = Math.max(96, Math.min(maxMenu, openUp ? spaceAbove : spaceBelow));
  return {
    left,
    width,
    maxHeight,
    top: openUp ? undefined : triggerRect.bottom + gap,
    bottom: openUp ? vh - triggerRect.top + gap : undefined,
  };
}

export default function SelectDropdown({
  value,
  onChange,
  options = [],
  placeholder = 'Select',
  disabled = false,
  name,
  id,
  className = '',
  required = false,
  'aria-label': ariaLabel,
}) {
  const generatedId = useId();
  const listboxId = `${generatedId}-listbox`;
  const buttonId = id || `${generatedId}-button`;
  const rootRef = useRef(null);
  const buttonRef = useRef(null);
  const menuRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [placement, setPlacement] = useState(null);
  const items = useMemo(() => normalizeOptions(options), [options]);
  const selectedIndex = items.findIndex((item) => item.value === String(value ?? ''));
  const selected = selectedIndex >= 0 ? items[selectedIndex] : null;
  const [activeIndex, setActiveIndex] = useState(Math.max(0, selectedIndex));

  const updatePlacement = useCallback(() => {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;
    setPlacement(menuPlacement(rect));
  }, []);

  const close = useCallback(() => setOpen(false), []);

  const selectValue = useCallback((next) => {
    onChange?.(next);
    setOpen(false);
    buttonRef.current?.focus();
  }, [onChange]);

  useLayoutEffect(() => {
    if (!open) return undefined;
    updatePlacement();
    const onReposition = () => updatePlacement();
    window.addEventListener('resize', onReposition);
    window.addEventListener('scroll', onReposition, true);
    return () => {
      window.removeEventListener('resize', onReposition);
      window.removeEventListener('scroll', onReposition, true);
    };
  }, [open, updatePlacement]);

  useEffect(() => {
    if (!open) return undefined;
    setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0);
    const onPointerDown = (event) => {
      if (rootRef.current?.contains(event.target) || menuRef.current?.contains(event.target)) return;
      close();
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [open, selectedIndex, close]);

  useEffect(() => {
    if (!open) return undefined;
    const option = menuRef.current?.querySelector('[data-active="true"]');
    option?.scrollIntoView({ block: 'nearest' });
  }, [open, activeIndex]);

  useEffect(() => {
    if (!open || !placement) return undefined;
    menuRef.current?.focus();
    return undefined;
  }, [open, placement]);

  const onButtonKeyDown = (event) => {
    if (disabled) return;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp' || event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      setOpen(true);
    }
  };

  const onMenuKeyDown = (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
      buttonRef.current?.focus();
      return;
    }
    if (event.key === 'Home') {
      event.preventDefault();
      setActiveIndex(0);
      return;
    }
    if (event.key === 'End') {
      event.preventDefault();
      setActiveIndex(items.length - 1);
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((current) => Math.min(items.length - 1, current + 1));
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((current) => Math.max(0, current - 1));
      return;
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      const item = items[activeIndex];
      if (item) selectValue(item.value);
    }
    if (event.key === 'Tab') close();
  };

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      {name ? (
        <input type="hidden" name={name} value={value ?? ''} required={required} />
      ) : null}
      <button
        ref={buttonRef}
        id={buttonId}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-label={ariaLabel}
        onClick={() => !disabled && setOpen((current) => !current)}
        onKeyDown={onButtonKeyDown}
        className="flex w-full cursor-pointer items-center justify-between gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-left text-sm text-gray-900 outline-none transition-colors focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:bg-[#121a2e] dark:text-slate-100 dark:focus:ring-indigo-400"
      >
        <span className={`min-w-0 truncate ${selected ? '' : 'text-gray-500 dark:text-slate-400'}`}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDownIcon
          className={`h-4 w-4 shrink-0 text-gray-500 transition-transform duration-200 dark:text-slate-300 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {typeof document !== 'undefined' ? createPortal(
        <AnimatePresence>
          {open && placement ? (
            <motion.ul
              ref={menuRef}
              id={listboxId}
              role="listbox"
              tabIndex={-1}
              aria-labelledby={buttonId}
              aria-activedescendant={`${listboxId}-opt-${activeIndex}`}
              onKeyDown={onMenuKeyDown}
              initial={{ opacity: 0, y: placement.bottom ? 6 : -6, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: placement.bottom ? 6 : -6, scale: 0.98 }}
              transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
              style={{
                position: 'fixed',
                left: placement.left,
                width: placement.width,
                top: placement.top,
                bottom: placement.bottom,
                maxHeight: placement.maxHeight,
                zIndex: 80,
              }}
              className="overflow-y-auto rounded-xl border border-gray-200 bg-white py-1 shadow-xl outline-none dark:border-white/10 dark:bg-[#0b1224] dark:shadow-black/40"
              data-select-dropdown-menu="true"
            >
              {items.map((item, index) => {
                const isSelected = item.value === String(value ?? '');
                const isActive = index === activeIndex;
                return (
                  <li
                    key={item.value || `empty-${index}`}
                    id={`${listboxId}-opt-${index}`}
                    role="option"
                    aria-selected={isSelected}
                    data-active={isActive ? 'true' : 'false'}
                    onMouseEnter={() => setActiveIndex(index)}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => selectValue(item.value)}
                    className={`flex cursor-pointer items-center justify-between gap-2 px-3 py-2 text-sm ${
                      isSelected
                        ? 'bg-blue-50 text-blue-800 dark:bg-sky-400/25 dark:text-white'
                        : isActive
                          ? 'bg-gray-50 text-gray-900 dark:bg-white/10 dark:text-white'
                          : 'text-gray-800 dark:text-slate-200'
                    }`}
                  >
                    <span className="truncate">{item.label}</span>
                    {isSelected ? <CheckIcon className="h-4 w-4 shrink-0" /> : null}
                  </li>
                );
              })}
            </motion.ul>
          ) : null}
        </AnimatePresence>,
        document.body,
      ) : null}
    </div>
  );
}
