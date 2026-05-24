import type { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes, ReactNode } from 'react';

export function MiniField({ label, children, helper }: { label?: ReactNode; helper?: ReactNode; children: ReactNode }) {
  return (
    <label className="mini-field">
      {label && <span className="mini-field__label">{label}</span>}
      {children}
      {helper && <span className="mini-helper">{helper}</span>}
    </label>
  );
}

export function MiniInput(props: InputHTMLAttributes<HTMLInputElement>) {
  const { className, ...rest } = props;
  return <input className={`mini-input ${className ?? ''}`} {...rest} />;
}

export function MiniSelect(props: SelectHTMLAttributes<HTMLSelectElement>) {
  const { className, ...rest } = props;
  return <select className={`mini-select ${className ?? ''}`} {...rest} />;
}

export function MiniTextarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const { className, ...rest } = props;
  return <textarea className={`mini-textarea ${className ?? ''}`} {...rest} />;
}
