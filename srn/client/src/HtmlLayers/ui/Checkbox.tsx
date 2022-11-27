import React from 'react';
import './Checkbox.scss';

export interface CheckboxProps {
  size: number;
  value: boolean;
  onChange: (newValue: boolean) => any;
}

export const Checkbox: React.FC<CheckboxProps> = ({
  size,
  value,
  onChange,
}) => {
  return (
    <span
      className="ui-checkbox"
      style={{
        fontSize: size,
        lineHeight: `${size}px`,
        height: size,
        width: size,
      }}
    >
      <input
        type="checkbox"
        checked={!!value}
        onChange={(ev) => {
          onChange(ev.target.checked);
        }}
      />
    </span>
  );
};
