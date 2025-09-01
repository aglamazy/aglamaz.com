import React from 'react';
import { useTranslation } from 'react-i18next';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  isClosable?: boolean;
}

const Modal: React.FC<ModalProps> = ({ isOpen, onClose, children, isClosable = true }) => {
  if (!isOpen) return null;
  const { t } = useTranslation();

  return (
    <div
      className="fixed inset-0 flex items-center justify-center bg-black/40"
      role="dialog"
      aria-modal="true"
    >
      <div className="relative bg-white p-6 rounded-xl shadow-lg max-w-md w-full">
        {isClosable && (
          <button
            onClick={onClose}
            className="absolute top-3 right-3 text-gray-700 hover:text-gray-900 text-2xl"
            aria-label={t('close') as string}
          >
            &times;
          </button>
        )}
        <div>{children}</div>
      </div>
    </div>
  );
};

export default Modal;
