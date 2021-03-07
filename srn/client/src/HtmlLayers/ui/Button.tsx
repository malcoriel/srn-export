import React, { useState } from 'react';
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
  const targetHotKey = hotkey || '🤣';
  const [pseudoActive, setPseudoActive] = useState(false);
  useHotkeys(
    targetHotKey,
    () => {
      if (onClick) {
        setTimeout(() => {
          onClick();
        }, 0);
      }
      setPseudoActive(false);
    },
    {
      keyup: true,
    }
  );
  useHotkeys(
    targetHotKey,
    () => {
      setPseudoActive(true);
    },
    { keydown: true }
  );
  return (
    <span
      className={classNames({
        'ui-button ': true,
        'pseudo-active': pseudoActive,
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
