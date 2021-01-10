import React from 'react';
import './Label.scss';

export const Label: React.FC<{ className?: string }> = ({
  children,
  className,
}) => {
  return <span className={`label ${className}`}>{children}</span>;
};
