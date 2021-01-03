import React from 'react';
import NetState, { findMyPlayer } from '../NetState';
import { Planet, Quest, QuestState } from '../world';
import { findPlanet } from './GameHTMLHudLayer';
import { useToggleHotkey } from '../utils/useToggleHotkey';

export const QuestPanel = () => {
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

  const show = useToggleHotkey('shift+q', true, 'show quest');
  if (!show) return null;

  return (
    <div className="panel game-panel quest-panel">
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
    </div>
  );
};
