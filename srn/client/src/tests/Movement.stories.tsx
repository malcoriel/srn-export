import React from 'react';
import { Meta } from '@storybook/react';
import {
  ActionIterator,
  FunctionalStoryTemplate,
  getStartGameParams,
} from './functionalStoryTools';
import { ActionBuilder } from '../../../world/pkg/world.extra';
import Vector from '../utils/Vector';
import { GameState } from '../../../world/pkg/world';
import { findMyShip } from '../ClientStateIndexing';

const storyName = 'Functional/Movement/SquareMovement';

const positions1 = [
  { x: 125.0, y: 125.0 },
  { x: 150.0, y: 100.0 },
  { x: 125.0, y: 75.0 },
  { x: 100.0, y: 100.0 },
];

export const SquareMovement = FunctionalStoryTemplate.bind({});
SquareMovement.args = {
  storyName,
};
const cyclicalMovementStory = (
  positions: any[],
  storyName: string,
  initialPos: { x: number; y: number },
  wait = 2000
) => () => {
  const star_ref_id = {
    tag: 'Reference' as const,
    reference: 'star',
  };

  let currentIdx = 0;

  return {
    storyName,
    forceCameraPosition: {
      x: 125,
      y: 100,
    },
    initialState: {
      force_seed: storyName,
      star: {
        radius: 50.0,
        id: star_ref_id,
      },
      planets: [],
      asteroid_belts: [],
    },
    initialPos,
    initialZoom: 1.1,
    actions: function* makeSequence() {
      while (true) {
        yield {
          wait,
          action: ActionBuilder.ActionNavigate({
            ship_id: '$my_ship_id',
            target: positions[currentIdx],
          }),
        };
        currentIdx++;
        currentIdx %= positions.length;
      }
    },
  };
};

const manualCyclicalMovementStory = (
  positions: any[],
  pressDuration: number,
  storyName: string,
  maxManualMoves: number,
  initialPos: { x: number; y: number },
  wait = 1000
) => () => {
  const star_ref_id = {
    tag: 'Reference' as const,
    reference: 'star',
  };

  let currentIdx = 0;

  return {
    storyName,
    forceCameraPosition: {
      x: 125,
      y: 100,
    },
    initialState: {
      force_seed: storyName,
      star: {
        radius: 50.0,
        id: star_ref_id,
      },
      planets: [],
      asteroid_belts: [],
    },
    initialPos,
    initialZoom: 1.1,
    actions: function* makeSequence(initialState: GameState): ActionIterator {
      let currentState: GameState = initialState;
      const MIN_DIST = 5;
      let manualMovesDone = 0;
      yield { wait, action: null };
      // let initialization happen
      while (true) {
        currentState = yield {
          wait,
          action: null,
        };
        const myShip = findMyShip(currentState);
        if (myShip) {
          break;
        }
        console.log('waiting for ship in state...');
      }
      while (true) {
        const currentTarget = positions[currentIdx];
        const myShip = findMyShip(currentState);
        if (!myShip) {
          throw new Error('Ship disappeared');
        }
        const myShipPos = Vector.fromIVector(myShip);
        if (
          Vector.fromIVector(currentTarget).euDistTo(
            Vector.fromIVector(myShipPos)
          ) <= MIN_DIST ||
          manualMovesDone > maxManualMoves
        ) {
          // too close or didn't arrive with maxManual moves - let's click-navigate
          currentState = yield {
            wait,
            action: ActionBuilder.ActionNavigate({
              ship_id: myShip.id,
              target: positions[currentIdx],
            }),
          };
          currentIdx++;
          currentIdx %= positions.length;
          manualMovesDone = 0;
          console.log('auto');
        } else {
          console.log('manual');
          manualMovesDone++;
          currentState = yield {
            wait,
            action: ActionBuilder.ActionGas({
              ship_id: myShip.id,
            }),
          };
        }
      }
    },
  };
};
getStartGameParams[storyName] = cyclicalMovementStory(positions1, storyName, {
  x: 100,
  y: 100,
});

const spaceTimeName = 'Functional/Movement/SpaceTime';
export const SpaceTime = FunctionalStoryTemplate.bind({});
SpaceTime.args = {
  storyName: spaceTimeName,
  debugSpaceTime: true,
};
getStartGameParams[spaceTimeName] = cyclicalMovementStory(
  [
    { x: 150.0, y: 75.0 },
    { x: 150.0, y: 125.0 },
  ],
  spaceTimeName,
  {
    x: 150,
    y: 125,
  },
  4000
);

const manualSpaceTime = 'Functional/Movement/ManualSpaceTime';
export const ManualSpaceTime = FunctionalStoryTemplate.bind({});
ManualSpaceTime.args = {
  storyName: manualSpaceTime,
  debugSpaceTime: true,
};
getStartGameParams[manualSpaceTime] = manualCyclicalMovementStory(
  [
    { x: 150.0, y: 75.0 },
    { x: 150.0, y: 125.0 },
  ],
  500,
  manualSpaceTime,
  10,
  {
    x: 150,
    y: 125,
  },
  500
);

export default {
  title: 'Functional/Movement',
  argTypes: {},
} as Meta;
