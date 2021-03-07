import React from 'react';
import './Button.scss';
import { useHotkeys } from 'react-hotkeys-hook';
import classNames from 'classnames';

const formatText = (text: string, hotkey?: string) => {
  if (hotkey) {
    const pos = text.toLowerCase().indexOf(hotkey.toLowerCase());
    if (pos > -1) {
      const parts = [
        text.substr(0, pos),
        text.substr(pos, 1),
        text.substr(pos + 1, text.length - pos - 1),
      ];
      return (
        <span>
          <span>{parts[0]}</span>
          <span className="hotkey-letter">{parts[1]}</span>
          <span>{parts[2]}</span>
        </span>
      );
    }
    return (
      <span>
        {text} ({hotkey})
      </span>
    );
  }
  return <span>{text}</span>;
};

export const Button: React.FC<{
  onClick?: () => void;
  className?: string;
  toggled?: boolean | null;
  hotkey?: string;
  text?: string;
  round?: boolean;
}> = ({ hotkey, round, text, onClick, children, className, toggled }) => {
  useHotkeys(hotkey || 'nonexistent', () => (onClick || Function.prototype)());
  return (
    <span
      className={classNames({
        'ui-button ': true,
        [className as string]: !!className,
        toggled,
        round,
      })}
      onClick={onClick}
    >
      {children}
      {text ? formatText(text, hotkey) : ''}
    </span>
  );
};
