import React from 'react';
import './Label.scss';

export const Label: React.FC<{ text: string }> = ({ text }) => {
  return <span className="label">{text}</span>;
};
