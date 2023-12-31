import React from 'react';
import './QuestWindow.scss';
import NetState from '../NetState';
import { findPlanet, PlanetV2, Quest, CargoDeliveryQuestState } from '../world';
import { Window } from './ui/Window';
import { findMyPlayer } from '../ClientStateIndexing';
import { useNSForceChange } from '../NetStateHooks';

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
        fromPlanet: PlanetV2;
        toPlanet: PlanetV2;
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
  const fromDone = questData.state === CargoDeliveryQuestState.Picked;
  const toDone = questData.state === CargoDeliveryQuestState.Delivered;

  const focus = (p: PlanetV2) => {
    visualState.cameraPosition = {
      x: p.spatial.position.x,
      y: p.spatial.position.y,
    };
    visualState.boundCameraMovement = false;
  };

  return (
    <Window
      storeKey="questWindow"
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
      contentClassName="quest-window-content"
    >
      <div className="header">
        Active quest: <span className="description">Cargo delivery</span>
        <span> -{questData.reward} cr. reward</span>
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
