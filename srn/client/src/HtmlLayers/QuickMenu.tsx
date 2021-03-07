import React, { ReactNode, useState } from 'react';
import { useHotkeys } from 'react-hotkeys-hook';
import { Button } from './ui/Button';
import './QuickMenu.scss';

type SingleMenuAction = {
  icon?: ReactNode;
  text: string;
  handler?: () => void;
};

type DeepMenuAction = {
  icon?: ReactNode;
  text: string;
  children: QuickMenuAction[];
};
type QuickMenuAction = SingleMenuAction | DeepMenuAction;

const isSingle = (act: QuickMenuAction): act is SingleMenuAction => {
  // noinspection SuspiciousTypeOfGuard
  return typeof (act as DeepMenuAction).children === 'undefined';
};

export const testQuickMenuActions = [
  {
    text: 'q',
  },
  {
    text: 'w',
  },
  {
    text: 'e',
    children: [
      {
        text: 'eq',
      },
      {
        text: 'ew',
      },
      {
        text: 'ee',
        children: [
          {
            text: 'eeq',
          },
          {
            text: 'eew',
          },
        ],
      },
    ],
  },
];

export type QuickMenuProps = { startActions: QuickMenuAction[] };
export const QuickMenu: React.FC<QuickMenuProps> = ({ startActions }) => {
  const [shown, setShown] = useState(true);
  const [activeActions, setActiveActions] = useState(startActions);
  const [levels, setLevels] = useState([] as number[]);

  const buildActiveActions = (levels: number[]) => {
    console.log('build', levels);
    const tmp = [...levels];
    let active = startActions;
    while (tmp.length) {
      const curr = tmp.shift() as number;
      const chosen = active[curr];
      if (!isSingle(chosen)) {
        active = chosen.children;
      } else {
        console.warn('invalid levels sequence', levels, startActions);
        setShown(false);
      }
    }
    setActiveActions(active);
  };

  const downLevel = () => {
    console.log('down level');
    if (levels.length === 0) {
      setShown(false);
    } else {
      setLevels((l) => {
        l.pop();
        return l;
      });
    }
    buildActiveActions(levels);
  };

  const upLevel = (actionIndex: number) => {
    console.log('upLevel', actionIndex);
    setLevels((levels) => {
      levels.push(actionIndex);
      return levels;
    });
    buildActiveActions(levels);
  };

  useHotkeys(
    'b',
    () => {
      if (!shown) {
        setShown(true);
      }
    },
    [setShown, shown]
  );
  if (!shown) return null;
  return (
    <div className="quick-menu-container">
      <div className="quick-menu">
        <div className="center-action">
          <Button round onClick={downLevel} hotkey="b" text="back" />
        </div>
        {activeActions.map((act, i) => {
          return (
            <div key={i} className="action">
              <Button
                round
                hotkey={String((i + 1) % 10)}
                onClick={() => {
                  if (isSingle(act)) {
                    if (act.handler) act.handler();
                    console.log('act', i + 1);
                  } else {
                    upLevel(i);
                  }
                }}
                text={act.text}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
};
