import React from 'react';
import { GameState, Planet, QuestState } from './world';
import { findMyPlayer } from './NetState';

export const findPlanet = (
  state: GameState,
  id: string
): Planet | undefined => {
  return state.planets.find((p) => p.id === id);
};

export const GameHTMLHudLayer: React.FC<{
  state: GameState;
  connecting: boolean;
}> = ({ connecting, state }) => {
  const myPlayer = findMyPlayer(state);
  let questData: any;
  if (myPlayer && myPlayer.quest) {
    const quest = myPlayer.quest;
    const fromPlanet = findPlanet(state, quest.from_id);
    const toPlanet = findPlanet(state, quest.to_id);
    if (fromPlanet && toPlanet) {
      questData = {};
      questData.from = {
        name: fromPlanet.name,
        color: quest.state === QuestState.Picked ? 'green' : 'white',
      };
      questData.to = {
        name: toPlanet.name,
        color: quest.state === QuestState.Delivered ? 'green' : 'white',
      };
      questData.reward = `${quest.reward} cr.`;
    }
  }

  return (
    <div
      style={{
        color: 'white',
        position: 'absolute',
        top: 0,
        left: 0,
        padding: 10,
        height: '100%',
        width: 'calc(100%-10px)',
      }}
    >
      {connecting && <span>Connecting...</span>}
      {questData && (
        <span>
          <span style={{ color: questData.from.color }}>
            {questData.from.name}
          </span>
          <span> -&gt; </span>
          <span style={{ color: questData.to.color }}>{questData.to.name}</span>
          <span>&nbsp;({questData.reward})</span>
        </span>
      )}
    </div>
  );
};
