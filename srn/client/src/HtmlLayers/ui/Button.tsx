import React, { ReactElement, useState } from 'react';
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

const renderHotkeyHint = (
  hotkey: string | undefined,
  noHotkeyHint: boolean | undefined
) => {
  if (noHotkeyHint) return null;
  if (!hotkey) return null;
  return <div className="hotkey-hint">{hotkey}</div>;
};

export const Button: React.FC<{
  onClick?: () => void;
  className?: string;
  disabled?: boolean;
  toggled?: boolean | null;
  hotkey?: string;
  text?: string;
  round?: boolean;
  thin?: boolean;
  forceHotkeyAsHint?: boolean;
  noInlineHotkey?: boolean;
  noHotkeyHint?: boolean;
}> = ({
  hotkey,
  noHotkeyHint,
  noInlineHotkey,
  round,
  text,
  onClick,
  children,
  className,
  toggled,
  thin,
  disabled,
  forceHotkeyAsHint,
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
      if (onClick && !disabled) {
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
  let textElem: null | ReactElement;

  if (text) {
    if (forceHotkeyAsHint) {
      textElem = (
        <>
          {formatText(text, '', noInlineHotkey)}
          {renderHotkeyHint(hotkey, noHotkeyHint)}
        </>
      );
    } else {
      textElem = formatText(text, hotkey, noInlineHotkey);
    }
  } else {
    textElem = renderHotkeyHint(hotkey, noHotkeyHint);
  }
  return (
    <span
      className={classNames({
        'ui-button ': true,
        'pseudo-active': pseudoActive,
        thin,
        [className as string]: !!className,
        toggled,
        round,
        disabled,
      })}
      onClick={disabled ? () => {} : timedOutClick}
    >
      {children}
      {textElem}
    </span>
  );
};
