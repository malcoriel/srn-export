import React, { ReactElement } from 'react';
import './ActionsBar.scss';
import { Button } from './ui/Button';

export interface ActionBarAction {
  icon?: ReactElement;
  text?: string;
  hotkey?: string;
  action: () => void;
}

export interface ActionsBarProps {
  actions: ActionBarAction[];
  indexByNumbers?: boolean;
}
export const ActionsBar: React.FC<ActionsBarProps> = ({
  actions,
  indexByNumbers,
}) => {
  return (
    <div className="actions-bar">
      <div className="background" />
      {actions.map(({ icon, text, hotkey, action }, i) => {
        return (
          <div key={i} className="action">
            <Button
              forceHotkeyAsHint
              className="action-button"
              text={text}
              hotkey={indexByNumbers ? String(i + 1) : hotkey}
              onClick={action}
            >
              {icon}
            </Button>
          </div>
        );
      })}
    </div>
  );
};
