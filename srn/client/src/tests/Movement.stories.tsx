import React from 'react';
import { Meta } from '@storybook/react';
import { genPeriod, PlanetType } from '../world';
import {
  FunctionalStoryTemplate,
  getStartGameParams,
} from './functionalStoryTools';
import {
  ActionBuilder,
  ReferencableIdBuilder,
} from '../../../world/pkg/world.extra';

const storyName = 'Functional/Movement';

const getStartGameParamsPlanets = () => {
  const star_ref_id = {
    tag: 'Reference' as const,
    reference: 'star',
  };

  return {
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
    },
    initialPos: {
      x: 100,
      y: 100,
    },
    initialZoom: 0.7,
    actions: [
      {
        wait: 0,
        action: ActionBuilder.ActionNavigate({
          ship_id: '$my_ship_id',
          target: { x: 150.0, y: 100.0 },
        }),
      },
    ],
  };
};

export const Main = FunctionalStoryTemplate.bind({});
Main.args = {
  storyName,
};
getStartGameParams[storyName] = getStartGameParamsPlanets;

export default {
  title: 'Functional/Movement',
  argTypes: {},
} as Meta;
