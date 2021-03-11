import React, { useState } from 'react';
import './Button.scss';
import { useHotkeys } from 'react-hotkeys-hook';
import classNames from 'classnames';

const formatText = (
  text: string,
  hotkey: string | undefined,
  noInlineHotkey: undefined | boolean
) => {
  if (hotkey) {
    const pos = text.toLowerCase().indexOf(hotkey.toLowerCase());
    if (pos > -1 && !noInlineHotkey) {
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
        {text} <span className="hotkey-letter">({hotkey})</span>
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
  thin?: boolean;
  noInlineHotkey?: boolean;
}> = ({
  hotkey,
  noInlineHotkey,
  round,
  text,
  onClick,
  children,
  className,
  toggled,
  thin,
}) => {
  const targetHotKey = hotkey || '🤣';
  const [pseudoActive, setPseudoActive] = useState(false);
  const timedOutClick = () => {
    setTimeout(() => {
      if (onClick) {
        onClick();
      }
    }, 0);
  };
  useHotkeys(
    targetHotKey,
    () => {
      if (onClick) {
        timedOutClick();
      }
      setPseudoActive(false);
    },
    {
      keyup: true,
    },
    [onClick, targetHotKey, pseudoActive]
  );
  useHotkeys(
    targetHotKey,
    () => {
      setPseudoActive(true);
    },
    { keydown: true },
    [onClick, targetHotKey, pseudoActive]
  );
  return (
    <span
      className={classNames({
        'ui-button ': true,
        'pseudo-active': pseudoActive,
        thin,
        [className as string]: !!className,
        toggled,
        round,
      })}
      onClick={timedOutClick}
    >
      {children}
      {text ? formatText(text, hotkey, noInlineHotkey) : ''}
    </span>
  );
};
