"use client";

import { motion } from "motion/react";

type ConfirmDialogProps = {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

/**
 * In-app confirmation modal — a non-blocking replacement for window.confirm(),
 * which freezes the main thread and is silently suppressed in iOS standalone
 * PWAs and some webviews (where it returns false without ever showing).
 */
export function ConfirmDialog({
  title,
  message,
  confirmLabel,
  cancelLabel = "Cancel",
  destructive = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <motion.div
      className="auth-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-title"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      onClick={onCancel}
    >
      <motion.div
        className="auth-modal confirm-modal"
        initial={{ opacity: 0, scale: 0.94 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: "spring", stiffness: 520, damping: 32 }}
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="confirm-title" className="auth-title">
          {title}
        </h2>
        <p className="auth-subtitle">{message}</p>

        <div className="confirm-actions">
          <button type="button" className="confirm-cancel" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className={`confirm-go ${destructive ? "danger" : ""}`}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
