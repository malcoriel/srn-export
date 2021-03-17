import React, { MutableRefObject, useEffect, useRef } from 'react';
import './Input.scss';
const suppress = (enable?: boolean) => (ev: any) => {
  if (!enable) return false;
  if (ev.code === 'Enter') {
    return true;
  }
  return enable ? ev.stopPropagation() : undefined;
};

export const Input: React.FC<{
  value: string;
  onChange: (ev: React.ChangeEvent<HTMLInputElement>) => void;
  className?: string;
  placeholder?: string;
  disabled?: boolean;
  autofocus?: boolean;
  noPropagation?: boolean;
}> = ({
  value,
  noPropagation,
  autofocus,
  disabled,
  onChange,
  className,
  placeholder,
}) => {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref && ref.current && autofocus) {
      setTimeout(() => {
        if (ref && ref.current) ref.current.focus();
      }, 0);
    }
  }, [autofocus]);
  return (
    <input
      ref={ref}
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
