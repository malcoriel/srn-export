import React from 'react';
import { Meta } from '@storybook/react';
import {
  FunctionalStoryTemplate,
  getStartGameParams,
} from './functionalStoryTools';
import { ActionBuilder } from '../../../world/pkg/world.extra';

const storyName = 'Functional/Movement/Main';

const positions1 = [
  { x: 125.0, y: 125.0 },
  { x: 150.0, y: 100.0 },
  { x: 125.0, y: 75.0 },
  { x: 100.0, y: 100.0 },
];

export const Main = FunctionalStoryTemplate.bind({});
Main.args = {
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
    actions: (function* makeSequence() {
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
    })(),
  };
};
getStartGameParams[storyName] = cyclicalMovementStory(positions1, storyName, {
  x: 100,
  y: 100,
});

const storyName2 = 'Functional/Movement/SpaceTime';
export const SpaceTime = FunctionalStoryTemplate.bind({});
SpaceTime.args = {
  storyName: storyName2,
};
const positions2 = [
  { x: 125.0, y: 75.0 },
  { x: 125.0, y: 125.0 },
];
getStartGameParams[storyName2] = cyclicalMovementStory(positions2, storyName2, {
  x: 125,
  y: 125,
}, 4000);

export default {
  title: 'Functional/Movement',
  argTypes: {},
} as Meta;
