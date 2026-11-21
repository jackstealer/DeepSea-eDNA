import { AnimatePresence, motion } from 'framer-motion';
import { AlertCircle, CheckCircle2, Info, AlertTriangle, X } from 'lucide-react';
import { useToastStore } from '@/store/toastStore';
import { cn } from '@/lib/utils';

export function ToastContainer() {
  const { toasts, removeToast } = useToastStore();

  return (
    <div
      aria-live="polite"
      aria-label="Notifications"
      className="fixed bottom-4 right-4 z-50 flex w-full max-w-sm flex-col gap-2 px-4 sm:px-0 pointer-events-none"
    >
      <AnimatePresence initial={false}>
        {toasts.map((item) => {
          const Icon =
            item.type === 'success'
              ? CheckCircle2
              : item.type === 'error'
              ? AlertCircle
              : item.type === 'warning'
              ? AlertTriangle
              : Info;

          const toneClass =
            item.type === 'success'
              ? 'border-emerald-200 dark:border-emerald-800/70 bg-white dark:glass-strong text-emerald-700 dark:text-emerald-300'
              : item.type === 'error'
              ? 'border-rose-200 dark:border-rose-800/70 bg-white dark:glass-strong text-rose-700 dark:text-rose-300'
              : item.type === 'warning'
              ? 'border-amber-200 dark:border-amber-800/70 bg-white dark:glass-strong text-amber-700 dark:text-amber-300'
              : 'border-cyan-200 dark:border-cyan-800/70 bg-white dark:glass-strong text-cyan-700 dark:text-cyan-300';

          return (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.98 }}
              transition={{ duration: 0.16 }}
              className={cn(
                'pointer-events-auto flex items-start gap-3 rounded-xl border p-3.5 shadow-lg backdrop-blur-md',
                toneClass
              )}
            >
              <Icon className="h-4 w-4 shrink-0 mt-0.5" />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                  {item.title}
                </p>
                {item.message && (
                  <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400 break-words">
                    {item.message}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => removeToast(item.id)}
                aria-label="Dismiss notification"
                className="rounded p-0.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
