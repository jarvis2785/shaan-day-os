'use client';

import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface ToastProps {
  message: string;
  visible: boolean;
  onHide: () => void;
}

export default function Toast({ message, visible, onHide }: ToastProps) {
  useEffect(() => {
    if (visible) {
      const timer = setTimeout(onHide, 1500);
      return () => clearTimeout(timer);
    }
  }, [visible, onHide]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="fixed top-8 left-1/2 z-50"
          style={{ x: '-50%' }}
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
        >
          <div
            className="rounded-btn px-4 py-2 text-[13px] font-medium shadow-lg"
            style={{ backgroundColor: '#1C1C1E', border: '1px solid #2C2C2E', color: '#30D158' }}
          >
            {message}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
