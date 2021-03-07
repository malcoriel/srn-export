import React from 'react';
import './QuestWindow.scss';
import NetState, { findMyPlayer, useNSForceChange } from '../NetState';
import { Planet, Quest, QuestState } from '../world';
import { findPlanet } from './NetworkStatus';
import { Window } from './ui/Window';

export const QuestWindow = () => {
  const ns = NetState.get();
  if (!ns) return null;

  useNSForceChange('QuestWindow', false, (prevState, nextState) => {
    const myPlayerPrev = findMyPlayer(prevState) || { quest: {} };
    const myPlayerNext = findMyPlayer(nextState) || { quest: {} };
    return (
      JSON.stringify(myPlayerPrev.quest) !== JSON.stringify(myPlayerNext.quest)
    );
  });

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
      minimized={
        questData && (
          <div className="quest-minimized">
            <span className="elem" onClick={() => focus(questData!.fromPlanet)}>
              {questData.fromPlanet.name}
            </span>
            <span> ➔ </span>
            <span className="elem" onClick={() => focus(questData!.toPlanet)}>
              {questData.toPlanet.name}
            </span>
          </div>
        )
      }
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
