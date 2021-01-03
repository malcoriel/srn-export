import React from 'react';
import NetState, { findMyPlayer } from '../NetState';
import { QuestState } from '../world';
import { findPlanet } from './GameHTMLHudLayer';

export const QuestPanel = () => {
  const ns = NetState.get();
  if (!ns) return null;
  const { connecting, state, ping, maxPing } = ns;
  const myPlayer = findMyPlayer(state);
  let questData;
  if (myPlayer && myPlayer.quest) {
    const quest = myPlayer.quest;
    const fromPlanet = findPlanet(state, quest.from_id);
    const toPlanet = findPlanet(state, quest.to_id);
    if (fromPlanet && toPlanet) {
      questData = {
        fromPlanet,
        toPlanet,
        reward: quest.reward,
        state: quest.state,
      };
    }
  }

  if (!questData) {
    return null;
  }
  let fromDone = questData.state === QuestState.Picked;
  let toDone = questData.state === QuestState.Delivered;
  return (
    <div className="panel game-panel quest-panel">
      <div className="header">
        Active quest: <span className="description">Cargo delivery</span>
      </div>
      <div className="stages">
        <div className={`line ${fromDone ? 'done' : ''}`}>
          1. Pick up the cargo at{' '}
          <span className="elem">{questData.fromPlanet.name}</span>
        </div>
        <div className={`line ${toDone ? 'done' : ''}`}>
          2. Drop the cargo at{' '}
          <span className="elem">{questData.toPlanet.name}</span>
        </div>
      </div>
    </div>
  );
};
