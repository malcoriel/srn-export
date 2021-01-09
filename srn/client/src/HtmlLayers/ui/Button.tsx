import React from 'react';
import './Button.scss';

export const Button: React.FC<{
  onClick?: () => void;
  className?: string;
  toggled?: boolean;
}> = ({ onClick, children, className, toggled }) => {
  return (
    <span
      className={`button ${className} ${toggled ? 'toggled' : ''}`}
      onClick={onClick}
    >
      {children}
    </span>
  );
};
