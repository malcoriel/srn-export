import React from 'react';
import './Button.scss';

export const Button: React.FC<{
  onClick?: () => void;
  className?: string;
  toggled?: boolean | null;
}> = ({ onClick, children, className, toggled }) => {
  return (
    <span
      className={`ui-button ${className} ${toggled ? 'toggled' : ''}`}
      onClick={onClick}
    >
      {children}
    </span>
  );
};
