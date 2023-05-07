import React from 'react';
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
  ReferencableIdBuilder,
  ShootTargetBuilder,
} from '../../../world/pkg/world.extra';
import { findMyShip } from '../ClientStateIndexing';

const rocketShootingStory = 'Functional/Combat/RocketShooting';
const getStartGameParamsRocketShooting = () => {
  const star_ref_id = {
    tag: 'Reference' as const,
    reference: 'star',
  };

  const asteroidId = '7d840590-01ce-4b37-a32a-037264da2e50';
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
          id: ReferencableIdBuilder.ReferencableIdId({
            id: asteroidId,
          }),
          position: {
            x: 175,
            y: 0,
          },
          radius: 2.0,
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
        const launchAbility = myShip.abilities.find((a) => a.tag === 'Launch');
        if (!launchAbility || launchAbility.tag !== 'Launch') {
          console.warn('no launch ability, cannot continue');
          break;
        }
        currentState = yield {
          wait: 1000,
          action: ActionBuilder.ActionLongActionStart({
            ship_id: '$my_ship_id',
            long_action_start: LongActionStartBuilder.LongActionStartLaunch({
              target: ShootTargetBuilder.ShootTargetAsteroid({
                id: asteroidId,
              }),
              turret_id: launchAbility.turret_id,
            }),
            player_id: '$my_player_id',
          }),
        };
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
