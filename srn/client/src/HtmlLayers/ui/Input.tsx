import React from 'react';
import './Input.scss';
export const Input: React.FC<{
  value: string;
  onChange: (ev: React.ChangeEvent<HTMLInputElement>) => void;
  className?: string;
  placeholder?: string
}> = ({ value, onChange, className, placeholder }) => {
  return (
    <input
      placeholder={placeholder}
      className={`input ${className}`}
      type="text"
      value={value}
      onChange={onChange}
    />
  );
};
