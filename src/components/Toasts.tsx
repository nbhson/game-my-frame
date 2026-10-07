import { AnimatePresence, motion } from 'framer-motion';
import { useGame } from '../game/store';

export default function Toasts() {
  const toasts = useGame((s) => s.toasts);
  return (
    <div className="fixed top-16 left-1/2 -translate-x-1/2 flex flex-col gap-2 items-center z-[60] pointer-events-none px-3 w-full max-w-md">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            initial={{ y: -16, opacity: 0, scale: 0.95 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: -10, opacity: 0 }}
            className="bg-[#2b2117] text-white px-4 py-2 rounded-2xl border-2 border-yellow-300 font-bold text-sm shadow-lg whitespace-nowrap max-w-full overflow-hidden text-ellipsis"
          >
            {t.msg}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
