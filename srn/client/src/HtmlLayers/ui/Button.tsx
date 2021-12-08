import React, { ReactElement, useState } from 'react';
import './Button.scss';
import { useHotkeys } from 'react-hotkeys-hook';
import classNames from 'classnames';
import {
  babyBlue,
  crimson,
  gray,
  semiTransparentGray,
  teal,
  transparentGray,
} from '../../utils/palette';

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

export type ButtonProps = {
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
  cooldownNormalized?: number;
  buttonWidth?: number;
  buttonHeight?: number;
};
export const Button: React.FC<ButtonProps> = ({
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
  cooldownNormalized = 0.0,
  buttonWidth = 0.0,
  buttonHeight = 0.0,
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

  const buttonRadius = (buttonWidth ** 2 + buttonHeight ** 2) ** 0.5 / 2.0;

  const coveredTrueValue = cooldownNormalized * 100;
  const coveredBefore50 = Math.min(coveredTrueValue, 50);
  const coveredAfter50 = Math.max(50, coveredTrueValue) - 50;

  const before50StyleCovered = {
    '--offset': 0,
    '--value': coveredBefore50,
    '--bg': semiTransparentGray,
  } as any;
  const after50StyleCovered = {
    '--offset': 50,
    '--value': coveredAfter50,
    '--bg': semiTransparentGray,
  } as any;

  const cooldownElem = cooldownNormalized && (
    <div
      className="ui-button-cooldown"
      style={{
        width: buttonRadius * 2,
        height: buttonRadius * 2,
        marginLeft: -(buttonRadius - buttonWidth / 2),
        marginTop: -(buttonRadius - buttonHeight / 2),
      }}
    >
      <div className="pie">
        <div className="pie__segment" style={before50StyleCovered} />
        <div className="pie__segment" style={after50StyleCovered} />
      </div>
    </div>
  );
  const mainButtonElem = (
    <>
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
    </>
  );

  let result: ReactElement;
  if (cooldownElem) {
    result = (
      <span className="ui-button-with-cooldown">
        {cooldownElem}
        {mainButtonElem}
      </span>
    );
  } else {
    result = mainButtonElem;
  }

  return result;
};
