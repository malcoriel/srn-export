import React from 'react';
import { Meta } from '@storybook/react';
import { genPeriod, PlanetType } from '../world';
import {
  FunctionalStoryTemplate,
  getStartGameParams,
} from './functionalStoryTools';
import { ReferencableIdBuilder } from '../../../world/pkg/world.extra';

const rocketShootingStory = 'Functional/Combat/RocketShooting';
const getStartGameParamsRocketShooting = () => {
  const star_ref_id = {
    tag: 'Reference' as const,
    reference: 'star',
  };

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
