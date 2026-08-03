'use client';

import { useEffect, useState } from 'react';

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

  if (!visible) return null;

  return (
    <div className="fixed top-8 left-1/2 -translate-x-1/2 z-50 animate-fade-in">
      <div className="bg-surface border border-border rounded-btn px-4 py-2 text-xs text-accent font-medium shadow-lg">
        {message}
      </div>
    </div>
  );
}
