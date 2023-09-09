import { Meta } from '@storybook/react';
import { GameState, genPeriod, PlanetType } from '../world';
import {
  ActionIterator,
  FunctionalStoryTemplate,
  getStartGameParams,
} from './functionalStoryTools';
import {
  ActionBuilder,
  LongActionStartBuilder,
  ObjectSpecifierBuilder,
  ReferencableIdBuilder,
  SandboxCommandBuilder,
} from '../../../world/pkg/world.extra';
import { findMyShip } from '../ClientStateIndexing';
import { Ability } from '../../../world/pkg/world';

const rocketShootingStory = 'Functional/Combat/RocketShooting';
const getStartGameParamsRocketShooting = () => {
  const star_ref_id = {
    tag: 'Reference' as const,
    reference: 'star',
  };

  let asteroidId;
  const asteroidPos = {
    x: 175,
    y: 0,
  };
  const asteroidRad = 2.0;
  return {
    storyName: rocketShootingStory,
    forceCameraPosition: {
      x: 150,
      y: 0,
    },
    initialState: {
      force_seed: rocketShootingStory,
      star: {
        radius: 50.0,
        id: star_ref_id,
      },
      asteroid_belts: [],
      planets: [],
      asteroids: [
        {
          position: asteroidPos,
          radius: asteroidRad,
          id: null,
        },
      ],
    },
    initialPos: {
      x: 125,
      y: 0,
    },
    initialRotation: Math.PI / 4,
    initialZoom: 0.8,
    actions: function* makeSequence(): ActionIterator {
      let currentState: GameState | null = null;
      while (true) {
        if (!currentState) {
          currentState = yield {
            wait: 100,
            action: null,
          };
          continue;
        }
        const myShip = findMyShip(currentState);
        if (!myShip) {
          currentState = yield {
            wait: 100,
            action: null,
          };
          continue;
        }
        const launchAbility = myShip.abilities.find(
          (a: Ability) => a.tag === 'Launch'
        );
        if (!launchAbility || launchAbility.tag !== 'Launch') {
          console.warn('no launch ability, cannot continue');
          break;
        }
        if (!myShip.fof_overrides) {
          console.log('overriding fof');
          currentState = yield {
            wait: 0,
            action: ActionBuilder.ActionSandboxCommand({
              player_id: '$my_player_id',
              command: SandboxCommandBuilder.SandboxCommandSetFofOverrides({
                fields: {
                  ship_id: '$my_ship_id',
                  overrides: {
                    obj_class: {
                      Asteroids: 'Foe',
                    },
                  },
                },
              }),
            }),
          };
        }

        if (!currentState) {
          currentState = yield {
            wait: 100,
            action: null,
          };
          continue;
        }

        const firstAsteroid = currentState.locations[0].asteroids[0];
        if (!firstAsteroid) {
          console.log('No target, attempting to spawn a new one');
          currentState = yield {
            wait: 1000,
            waitAfter: 1000,
            action: ActionBuilder.ActionSandboxCommand({
              player_id: '$my_player_id',
              command: SandboxCommandBuilder.SandboxCommandAddAsteroid({
                fields: {
                  position: asteroidPos,
                  radius: asteroidRad,
                  id: null,
                },
              }),
            }),
          };
        } else {
          asteroidId = firstAsteroid.id;
          currentState = yield {
            action: ActionBuilder.ActionLongActionStart({
              ship_id: '$my_ship_id',
              long_action_start: LongActionStartBuilder.LongActionStartLaunch({
                turret_id: launchAbility.turret_id,
              }),
              player_id: '$my_player_id',
            }),
            waitAfter: 500,
          };
        }
      }
      return {
        wait: 100,
        action: null,
      };
    },
  };
};
export const RocketShooting = FunctionalStoryTemplate.bind({});
RocketShooting.args = {
  storyName: rocketShootingStory,
};
getStartGameParams[rocketShootingStory] = getStartGameParamsRocketShooting;
export default {
  title: 'Functional/Combat',
  argTypes: {},
} as Meta;
