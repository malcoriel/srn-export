import React from 'react';
import './Input.scss';
export const Input: React.FC<{
  value: string;
  onChange: (ev: React.ChangeEvent<HTMLInputElement>) => void;
  className?: string;
  placeholder?: string
  disabled?: boolean
}> = ({ value, disabled, onChange, className, placeholder }) => {
  return (
    <input
      disabled={disabled}
      placeholder={placeholder}
      className={`input ${className}`}
      type="text"
      value={value}
      onChange={onChange}
    />
  );
};
