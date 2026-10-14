import { useEffect } from 'react';

import styles from './Toast.module.css';

type ToastProps = {
  title: string;
  description?: string;
  isOpen: boolean;
  onClose: () => void;
  /** 0이면 자동으로 닫지 않는다. */
  duration?: number;
  className?: string;
};

const Toast = ({ title, description, isOpen, onClose, duration = 8000, className }: ToastProps) => {
  useEffect(() => {
    if (!isOpen || duration <= 0) return;
    const timer = setTimeout(onClose, duration);
    return () => clearTimeout(timer);
  }, [isOpen, duration, onClose]);
  if (!isOpen) return null;
  return (
    <aside
      className={[styles.toast, className].filter(Boolean).join(' ')}
      role="status"
      aria-label={title}
      aria-live="polite"
      aria-atomic="true"
    >
      <strong>{title}</strong>
      {description && <p>{description}</p>}
    </aside>
  );
};
export default Toast;
