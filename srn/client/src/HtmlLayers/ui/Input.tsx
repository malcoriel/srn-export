import React from 'react';
import './Input.scss';
export const Input: React.FC<{
  value: string;
  onChange: (ev: React.ChangeEvent<HTMLInputElement>) => void;
  className?: string;
}> = ({ value, onChange, className }) => {
  return (
    <input
      className={`input ${className}`}
      type="text"
      value={value}
      onChange={onChange}
    />
  );
};
