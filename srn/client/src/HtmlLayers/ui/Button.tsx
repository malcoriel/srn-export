import React from 'react';
import './Button.scss';

export const Button: React.FC<{
  onClick?: () => void;
  text: string;
  className?: string;
  toggled?: boolean;
}> = ({ onClick, text, className, toggled }) => {
  return (
    <span
      className={`button ${className} ${toggled ? 'toggled' : ''}`}
      onClick={onClick}
    >
      {text}
    </span>
  );
};
