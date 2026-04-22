import React, { useEffect } from 'react';

interface Props {
  message: string;
  type: 'success' | 'error' | 'info';
  onDismiss: () => void;
}

const Toast: React.FC<Props> = ({ message, type, onDismiss }) => {
  useEffect(() => {
    const timer = setTimeout(onDismiss, 3000);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  const colors = {
    success: 'bg-green-600',
    error: 'bg-red-600',
    info: 'bg-blue-600',
  };

  return (
    <div
      className={`fixed bottom-4 right-4 z-50 px-4 py-3 rounded-lg text-white shadow-lg ${colors[type]} flex items-center gap-3`}
    >
      <span className="text-sm">{message}</span>
      <button onClick={onDismiss} className="text-white/80 hover:text-white text-lg leading-none">
        ×
      </button>
    </div>
  );
};

export default Toast;
