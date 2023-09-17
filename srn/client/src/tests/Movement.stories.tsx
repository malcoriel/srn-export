import { Meta } from '@storybook/react';
import {
  ActionIterator,
  FunctionalStoryTemplate,
  getStartGameParams,
} from './functionalStoryTools';
import {
  ActionBuilder,
  LongActionBuilder,
  LongActionStartBuilder,
  SandboxCommandBuilder,
} from '../../../world/pkg/world.extra';
import Vector from '../utils/Vector';
import { GameState } from '../../../world/pkg/world';
import { findMyShip } from '../ClientStateIndexing';

const squareMovementName = 'Functional/Movement/SquareMovement';

const positions1 = [
  { x: 125.0, y: 125.0 },
  { x: 150.0, y: 100.0 },
  { x: 125.0, y: 75.0 },
  { x: 100.0, y: 100.0 },
];

export const SquareMovement = FunctionalStoryTemplate.bind({});
SquareMovement.args = {
  storyName: squareMovementName,
  accelerated: true,
};
const cyclicalMovementStory = (
  positions: any[],
  storyName: string,
  initialPos: { x: number; y: number },
  wait = 2000
) => ({ accelerated = false } = {}) => {
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
      asteroids: [],
      asteroid_belts: [],
    },
    initialPos,
    initialZoom: 1.1,
    actions: function* makeSequence() {
      if (accelerated) {
        yield {
          wait: 0,
          waitAfter: 1000,
          action: ActionBuilder.ActionLongActionStart({
            player_id: '$my_player_id',
            long_action_start: LongActionStartBuilder.LongActionStartUseAbilityName(
              {
                ability_name: 'ToggleMovement',
                params: null,
              }
            ),
            ship_id: '$my_ship_id',
          }),
        };
      }
      while (true) {
        console.log('navigating to ', positions[currentIdx]);
        yield {
          waitAfter: wait,
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
      asteroids: [],
      asteroid_belts: [],
    },
    initialPos,
    initialZoom: 1.1,
    actions: function* makeSequence(
      initialState: GameState | null
    ): ActionIterator {
      let currentState: GameState | null = initialState;
      const MIN_DIST = 5;
      let manualMovesDone = 0;
      yield { wait, action: null };
      // let initialization happen
      while (true) {
        currentState = yield {
          wait,
          action: null,
        };
        if (!currentState) {
          break;
        }
        const myShip = findMyShip(currentState);
        if (myShip) {
          break;
        }
        console.log('waiting for ship in state...');
      }
      let isPressing = false;
      while (true) {
        if (!currentState) {
          break;
        }
        const currentTarget = positions[currentIdx];
        const myShip = findMyShip(currentState);
        if (!myShip) {
          throw new Error('Ship disappeared');
        }
        const myShipPos = Vector.fromIVector(myShip.spatial.position);
        if (
          Vector.fromIVector(currentTarget).euDistTo(
            Vector.fromIVector(myShipPos)
          ) <= MIN_DIST ||
          manualMovesDone >= maxManualMoves
        ) {
          // too close or didn't arrive with maxManual moves - let's click-navigate
          currentState = yield {
            action: ActionBuilder.ActionStopGas({
              ship_id: myShip.id,
            }),
          };
          currentState = yield {
            action: ActionBuilder.ActionNavigate({
              ship_id: myShip.id,
              target: positions[currentIdx],
            }),
            waitAfter: 4000,
          };
          currentIdx++;
          currentIdx %= positions.length;
          manualMovesDone = 0;
        } else {
          // eslint-disable-next-line no-lonely-if
          if (!isPressing) {
            isPressing = true;
            manualMovesDone++;
            currentState = yield {
              action: ActionBuilder.ActionGas({
                ship_id: myShip.id,
              }),
              waitAfter: pressDuration,
            };
          } else {
            isPressing = false;
            currentState = yield {
              action: ActionBuilder.ActionStopGas({
                ship_id: myShip.id,
              }),
              waitAfter: wait,
            };
          }
        }
      }
      return {
        wait: 0,
        action: null,
      };
    },
  };
};
getStartGameParams[squareMovementName] = cyclicalMovementStory(
  positions1,
  squareMovementName,
  {
    x: 100,
    y: 100,
  },
  5000
);

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
  100,
  manualSpaceTime,
  2,
  {
    x: 150,
    y: 125,
  },
  2000
);

// noinspection JSUnusedGlobalSymbols
export default {
  title: 'Functional/Movement',
} as Meta;
