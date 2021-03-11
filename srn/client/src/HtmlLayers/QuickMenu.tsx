import React, { ReactNode, useCallback, useEffect, useState } from 'react';
import { useHotkeys } from 'react-hotkeys-hook';
import { Button } from './ui/Button';
import './QuickMenu.scss';
import { ImCross } from 'react-icons/all';

type SingleMenuAction = {
  icon?: ReactNode;
  text: string;
  noHide?: boolean;
  handler?: () => void;
};

type DeepMenuAction = {
  icon?: ReactNode;
  text: string;
  list?: boolean;
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
    text: 'rt',
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

export type QuickMenuProps = {
  startActions: QuickMenuAction[];
  mainHotkey: string;
};
export const QuickMenu: React.FC<QuickMenuProps> = ({
  startActions,
  mainHotkey,
}) => {
  const [shown, setShown] = useState(false);
  const [animatedRotation, setAnimatedRotation] = useState(false);
  const [activeActions, setActiveActions] = useState(startActions);
  const [currentAction, setCurrentAction] = useState<DeepMenuAction | null>(
    null
  );

  // when the start actions are reset due to a no-hide option,
  // without this the state will not update (it has to be reset like this)
  useEffect(() => {
    setActiveActions(startActions);
  }, [startActions]);
  const [levels, setLevels] = useState([] as number[]);

  const buildActiveActions = useCallback(
    (levels: number[]) => {
      const tmp = [...levels];
      let active = startActions;
      let chosen: SingleMenuAction | DeepMenuAction | null = null;
      while (tmp.length) {
        const curr = tmp.shift() as number;
        chosen = active[curr];
        if (!isSingle(chosen)) {
          active = chosen.children;
        } else {
          console.warn('invalid levels sequence', levels, startActions);
          setShown(false);
          setAnimatedRotation(false);
        }
      }
      if (chosen && !isSingle(chosen)) {
        setCurrentAction(chosen);
      }
      setActiveActions(active);
    },
    [startActions]
  );

  const downLevel = () => {
    if (levels.length === 0) {
      setShown(false);
      setAnimatedRotation(false);
    } else {
      setLevels((l) => {
        l.pop();
        return l;
      });
    }
    buildActiveActions(levels);
  };

  const upLevel = (actionIndex: number) => {
    setLevels((levels) => {
      levels.push(actionIndex);
      return levels;
    });
    buildActiveActions(levels);
  };

  const reset = () => {
    setLevels([]);
    buildActiveActions([]);
    setShown(false);
    setAnimatedRotation(false);
    setCurrentAction(null);
  };

  useHotkeys(
    mainHotkey,
    () => {
      if (!shown) {
        setShown(true);
        setTimeout(() => {
          setAnimatedRotation(true);
        }, 0);
      }
    },
    [setShown, shown]
  );
  if (!shown) return null;

  const menuStyle = currentAction && currentAction.list ? 'list' : 'rounded';
  const roundButtons = menuStyle === 'rounded';
  const thinButtons = menuStyle === 'list';
  return (
    <div className="quick-menu-container">
      <div className={`quick-menu ${menuStyle} count-${activeActions.length}`}>
        <div className="action center-action">
          <Button
            thin={thinButtons}
            round={roundButtons}
            onClick={downLevel}
            hotkey="b"
            text="BACK"
          >
            <span className="icon">
              <ImCross />
            </span>
          </Button>
        </div>
        {activeActions.map((act, i) => {
          return (
            <div
              key={i}
              className={`action ${animatedRotation ? `rotate-${i}` : ''}`}
            >
              <Button
                thin={thinButtons}
                round={roundButtons}
                hotkey={String((i + 1) % 10)}
                noInlineHotkey
                onClick={() => {
                  if (isSingle(act)) {
                    if (act.handler) {
                      act.handler();
                    }
                    if (!act.noHide) {
                      reset();
                    }
                  } else {
                    upLevel(i);
                  }
                }}
                text={act.text}
              >
                {act.icon ? <span className="icon">{act.icon}</span> : null}
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
};
