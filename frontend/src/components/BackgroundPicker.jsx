import { useEffect, useId, useRef } from 'react';
import { PhotoIcon, PlusIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { CheckCircleIcon } from '@heroicons/react/24/solid';

export const BACKGROUND_PRESETS = [
  { id: 'office', name: 'Office', url: '/backgrounds/office.png' },
  { id: 'studio', name: 'Studio', url: '/backgrounds/studio.png' },
  { id: 'home', name: 'Home', url: '/backgrounds/home.png' },
];

const TABS = [
  { id: 'blur', label: 'Blur' },
  { id: 'custom', label: 'Custom' },
  { id: 'presets', label: 'Presets' },
];

function thumbClass(active) {
  return `relative overflow-hidden rounded-xl border text-left transition ${
    active
      ? 'border-sky-400 ring-2 ring-sky-400/80'
      : 'border-slate-200 hover:border-sky-300 dark:border-slate-600 dark:hover:border-sky-400'
  }`;
}

function ActiveMark({ active }) {
  if (!active) return null;
  return <CheckCircleIcon className="absolute right-1 top-1 h-4 w-4 text-sky-400 drop-shadow" />;
}

export default function BackgroundPicker({
  open,
  onClose,
  effect,
  onSelect,
  customBackground,
  onUpload,
  error,
  tab,
  onTabChange,
  anchorRef,
  loading = false,
  unavailable = false,
}) {
  const panelRef = useRef(null);
  const fileId = useId();

  useEffect(() => {
    if (!open) return undefined;
    const onPointer = (event) => {
      const target = event.target;
      if (panelRef.current?.contains(target) || anchorRef?.current?.contains(target)) return;
      onClose();
    };
    const onKey = (event) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('touchstart', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('touchstart', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [anchorRef, onClose, open]);

  if (!open) return null;

  const handleFiles = (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (file) onUpload(file);
  };

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-label="Choose your background"
      className="fixed inset-x-3 bottom-[5.75rem] z-50 w-auto max-h-[min(70vh,28rem)] overflow-y-auto rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-2xl shadow-slate-950/30 backdrop-blur-md dark:border-slate-600 dark:bg-slate-900/95 sm:absolute sm:inset-auto sm:bottom-auto sm:right-2 sm:top-12 sm:w-72 lg:w-80"
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2 text-slate-800 dark:text-slate-100">
          <PhotoIcon className="h-5 w-5 shrink-0 text-sky-500" />
          <div className="min-w-0">
            <p className="text-sm font-semibold">Background</p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">Choose your background</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
          aria-label="Close background panel"
        >
          <XMarkIcon className="h-5 w-5" />
        </button>
      </div>

      {loading ? (
        <p className="mb-2 text-xs text-sky-600 dark:text-sky-300">Preparing background… Camera stays on.</p>
      ) : null}
      {unavailable ? (
        <p className="mb-2 text-xs text-amber-600 dark:text-amber-300">
          Background effects are unavailable. Your camera feed stays visible.
        </p>
      ) : null}

      <div className="mb-3 grid grid-cols-3 gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => {
              onTabChange(item.id);
              if (item.id === 'blur') onSelect({ kind: 'blur' });
            }}
            className={`rounded-lg px-2 py-1.5 text-xs font-medium ${
              tab === item.id
                ? 'bg-white text-slate-900 shadow dark:bg-slate-700 dark:text-white'
                : 'text-slate-500 dark:text-slate-400'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === 'blur' && (
        <button type="button" onClick={() => onSelect({ kind: 'blur' })} className={`block w-full ${thumbClass(effect.kind === 'blur')}`}>
          <ActiveMark active={effect.kind === 'blur'} />
          <span className="block h-20 w-full bg-[linear-gradient(135deg,#64748b,#94a3b8)] blur-[1px]" />
          <span className="block px-2 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200">Blur</span>
        </button>
      )}

      {tab === 'custom' && (
        <div className="grid grid-cols-2 gap-2">
          {customBackground ? (
            <button
              type="button"
              onClick={() => onSelect({ kind: 'image', id: 'custom', url: customBackground.url })}
              className={thumbClass(effect.id === 'custom')}
            >
              <ActiveMark active={effect.id === 'custom'} />
              <img src={customBackground.url} alt="" className="h-16 w-full object-cover" />
              <span className="block truncate px-2 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200">
                Custom
              </span>
            </button>
          ) : (
            <p className="col-span-2 text-xs text-slate-500 dark:text-slate-400">Upload an image to use it as your background.</p>
          )}
        </div>
      )}

      {tab === 'presets' && (
        <div className="grid grid-cols-3 gap-2">
          <button type="button" onClick={() => onSelect({ kind: 'none' })} className={thumbClass(effect.kind === 'none')}>
            <ActiveMark active={effect.kind === 'none'} />
            <span className="flex h-16 items-center justify-center bg-slate-200 text-[10px] font-medium text-slate-600 dark:bg-slate-700 dark:text-slate-300">
              Original
            </span>
            <span className="block px-1 py-1.5 text-center text-[11px] font-medium text-slate-700 dark:text-slate-200">None</span>
          </button>
          {BACKGROUND_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => onSelect({ kind: 'image', id: preset.id, url: preset.url })}
              className={thumbClass(effect.id === preset.id)}
            >
              <ActiveMark active={effect.id === preset.id} />
              <img src={preset.url} alt="" className="h-16 w-full object-cover" />
              <span className="block truncate px-1 py-1.5 text-center text-[11px] font-medium text-slate-700 dark:text-slate-200">
                {preset.name}
              </span>
            </button>
          ))}
        </div>
      )}

      {error ? <p className="mt-2 text-xs text-red-500">{error}</p> : null}

      <label
        htmlFor={fileId}
        className="mt-3 flex cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3 py-2.5 text-xs font-semibold text-slate-700 hover:border-sky-400 hover:text-sky-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-sky-400 dark:hover:text-sky-300"
      >
        <PlusIcon className="h-4 w-4" />
        Upload Image
      </label>
      <input id={fileId} type="file" accept="image/*" className="sr-only" onChange={handleFiles} />
    </div>
  );
}
