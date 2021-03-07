import React from 'react';
import './Input.scss';
const suppress = (enable?: boolean) => (ev: any) => {
  if (ev.code === 'Enter') return;
  return enable ? ev.stopPropagation() : undefined;
};

export const Input: React.FC<{
  value: string;
  onChange: (ev: React.ChangeEvent<HTMLInputElement>) => void;
  className?: string;
  placeholder?: string;
  disabled?: boolean;
  noPropagation?: boolean;
}> = ({ value, noPropagation, disabled, onChange, className, placeholder }) => {
  return (
    <input
      onKeyUp={suppress(noPropagation)}
      onKeyDown={suppress(noPropagation)}
      onKeyPress={suppress(noPropagation)}
      disabled={disabled}
      placeholder={placeholder}
      className={`input ${className}`}
      type="text"
      value={value}
      onChange={onChange}
    />
  );
};
