import React from 'react';
import { useTranslation } from 'react-i18next';
import Modal from './Modal';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  loading?: boolean;
  error?: string;
  onConfirm: () => Promise<void> | void;
  onCancel: () => void;
}

export default function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmLabel,
  cancelLabel,
  destructive = false,
  loading = false,
  error,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const { t } = useTranslation();
  const confirmText = confirmLabel || (destructive ? (t('delete') as string) : (t('confirm') as string));
  const cancelText = cancelLabel || (t('cancel') as string);
  return (
    <Modal isOpen={isOpen} onClose={onCancel} isClosable={!loading}>
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">{title}</h3>
        {message && <p className="text-sm text-gray-600">{message}</p>}
        {error && (
          <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-2">
            {error}
          </div>
        )}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="px-3 py-1 rounded border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={`${destructive ? 'bg-red-600 hover:bg-red-700' : 'bg-primary hover:bg-secondary'} text-white px-3 py-1 rounded disabled:opacity-50`}
          >
            {loading ? (t('deleting') as string) : confirmText}
          </button>
        </div>
      </div>
    </Modal>
  );
}
