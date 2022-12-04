import React, { ReactElement } from 'react';
import './ActionsBar.scss';
import { Button } from './ui/Button';

const actionSize = 48;

export interface ActionBarAction {
  icon?: ReactElement;
  text?: string;
  hotkey?: string;
  cooldownNormalized?: number;
  action: () => void;
}

export interface ActionsBarProps {
  actions: ActionBarAction[];
  indexByNumbers?: boolean;
  className?: string;
}
export const ActionsBar: React.FC<ActionsBarProps> = ({
  actions,
  indexByNumbers,
  className = '',
}) => {
  return (
    <div className={`actions-bar ${className}`}>
      <div className="background" />
      {actions.map(({ icon, text, hotkey, cooldownNormalized, action }, i) => {
        return (
          <div key={i} className="action">
            <Button
              forceHotkeyAsHint
              className="action-button"
              text={text}
              hotkey={indexByNumbers ? String(i + 1) : hotkey}
              hotkeyScope="game"
              onClick={action}
              cooldownAreaHeight={actionSize}
              cooldownAreaWidth={actionSize}
              cooldownNormalized={cooldownNormalized}
            >
              {icon}
            </Button>
          </div>
        );
      })}
    </div>
  );
};
