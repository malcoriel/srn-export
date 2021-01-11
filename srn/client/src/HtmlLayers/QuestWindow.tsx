import React from 'react';
import './QuestWindow.scss';
import { StyledRect } from './ui/StyledRect';
import NetState, { findMyPlayer } from '../NetState';
import { Planet, Quest, QuestState } from '../world';
import { findPlanet } from './GameHTMLHudLayer';
import { useStore, WindowState } from '../store';
import _ from 'lodash';
import { Button } from './ui/Button';
import { CgClose } from 'react-icons/all';

export const Window: React.FC<{
  storeKey: string;
  minimized?: React.ReactNode;
  width: number;
  height: number;
  thickness: number;
  line: 'complex' | 'thick' | 'thin';
  halfThick?: boolean;
  contentClassName?: string;
  className?: string;
}> = ({
  storeKey,
  children,
  width,
  height,
  thickness,
  line,
  minimized,
  className,
  contentClassName,
}) => {
  const key = storeKey;
  const setKey = `set${_.upperFirst(key)}`;
  const storeParts = useStore((state) => ({
    [key]: (state as Record<string, any>)[key],
    [setKey]: (state as Record<string, any>)[setKey],
  }));
  const state = storeParts[key] as WindowState;
  const minimize = () => storeParts[setKey](WindowState.Minimized);
  const hide = () => storeParts[setKey](WindowState.Hidden);

  const isShown = state === WindowState.Shown;
  const isMinimized = state === WindowState.Minimized;

  const windowButtons = (
    <div className="ui-window-controls" style={{ height: thickness }}>
      {minimized && <Button onClick={minimize}>_</Button>}
      <Button onClick={hide}>
        <CgClose />
      </Button>
    </div>
  );
  return (
    <div className="ui-window">
      {isShown && (
        <div className={`ui-window-shown ${className}`}>
          <StyledRect
            width={width}
            height={height}
            line={line}
            thickness={thickness}
            contentClassName={contentClassName}
          >
            {windowButtons}
            {children}
          </StyledRect>
        </div>
      )}

      {isMinimized && (
        <div className="ui-window-minimized">
          {windowButtons}
          {minimized}
        </div>
      )}
    </div>
  );
};

export const QuestWindow = () => {
  const ns = NetState.get();
  if (!ns) return null;

  const { state, visualState } = ns;
  const myPlayer = findMyPlayer(state);
  let questData:
    | (Quest & {
        fromPlanet: Planet;
        toPlanet: Planet;
      })
    | undefined;
  if (myPlayer && myPlayer.quest) {
    const quest = myPlayer.quest;
    const fromPlanet = findPlanet(state, quest.from_id);
    const toPlanet = findPlanet(state, quest.to_id);
    if (fromPlanet && toPlanet) {
      questData = {
        fromPlanet,
        toPlanet,
        ...quest,
      };
    }
  }

  if (!questData) {
    return null;
  }
  let fromDone = questData.state === QuestState.Picked;
  let toDone = questData.state === QuestState.Delivered;

  const focus = (p: Planet) => {
    visualState.cameraPosition = { x: p.x, y: p.y };
    visualState.boundCameraMovement = false;
  };

  return (
    <Window
      storeKey={'questWindow'}
      className="quest-window"
      width={300}
      height={200}
      line="thick"
      thickness={10}
    >
      <div className="header">
        Active quest: <span className="description">Cargo delivery</span>
        <span> - {questData.reward} cr. reward</span>
      </div>
      <div className="stages">
        <div className={`line ${fromDone ? 'done' : ''}`}>
          1. Pick up the cargo at{' '}
          <span className="elem" onClick={() => focus(questData!.fromPlanet)}>
            {questData.fromPlanet.name}
          </span>
        </div>
        <div className={`line ${toDone ? 'done' : ''}`}>
          2. Drop the cargo at{' '}
          <span className="elem" onClick={() => focus(questData!.toPlanet)}>
            {questData.toPlanet.name}
          </span>
        </div>
      </div>
    </Window>
  );
};
