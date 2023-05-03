import React from 'react';
import { Meta } from '@storybook/react';
import { genPeriod, PlanetType } from '../world';
import {
  FunctionalStoryTemplate,
  getStartGameParams,
} from './functionalStoryTools';
import { ReferencableIdBuilder } from '../../../world/pkg/world.extra';

const planetsStory = 'Functional/Celestial/Planets';
const getStartGameParamsPlanets = () => {
  const star_ref_id = {
    tag: 'Reference' as const,
    reference: 'star',
  };

  return {
    storyName: planetsStory,
    initialState: {
      force_seed: planetsStory,
      star: {
        radius: 50.0,
        id: star_ref_id,
      },
      asteroid_belts: [],
      asteroids: [],
      planets: [
        {
          p_type: PlanetType.Jovian,
          id: ReferencableIdBuilder.ReferencableIdId({
            id: '7d840590-01ce-4b37-a32a-037264da2e50',
          }),
          position: {
            x: 151.5383771371988,
            y: 15.99053448539727,
          },
          radius: 10.40783200434442,
          full_period_ticks: genPeriod('aaaaa'),
          anchor_id: star_ref_id,
          anchor_tier: 1,
        },
        {
          p_type: PlanetType.Jovian,
          id: ReferencableIdBuilder.ReferencableIdId({
            id: '236c0d02-0f3e-4b6a-b38c-f585c37d1fda',
          }),
          position: {
            x: 48.190782610927485,
            y: -346.1008470849561,
          },
          radius: 13.034404808418401,
          full_period_ticks: genPeriod('bbbbb'),
          anchor_id: star_ref_id,
          anchor_tier: 1,
        },
        {
          p_type: PlanetType.Jovian,
          id: ReferencableIdBuilder.ReferencableIdId({
            id: 'c9a20a37-01d0-4c04-a6cb-537858188225',
          }),
          position: {
            x: 271.90342161745934,
            y: 355.0107661147141,
          },
          radius: 14.284974612384675,
          full_period_ticks: genPeriod('ccccc'),
          anchor_id: star_ref_id,
          anchor_tier: 1,
        },
        {
          p_type: PlanetType.Jovian,
          id: ReferencableIdBuilder.ReferencableIdId({
            id: '69ac2146-bd80-4662-a415-0ab29674e299',
          }),
          position: {
            x: 143.00871333645205,
            y: 43.567516371004665,
          },
          radius: 2.118708819446513,
          full_period_ticks: genPeriod('ddddd'),
          anchor_id: ReferencableIdBuilder.ReferencableIdId({
            id: '7d840590-01ce-4b37-a32a-037264da2e50',
          }),
          anchor_tier: 2,
        },
      ],
    },
    initialPos: {
      x: 150,
      y: 0,
    },
    initialZoom: 0.8,
  };
};
export const Planets = FunctionalStoryTemplate.bind({});
Planets.args = {
  storyName: planetsStory,
};
getStartGameParams[planetsStory] = getStartGameParamsPlanets;
const asteroidBeltStory = 'Functional/Celestial/AsteroidBelt';
const getStartGameParamsAsteroidBelt = () => {
  const star_ref_id = {
    tag: 'Reference' as const,
    reference: 'star',
  };

  return {
    storyName: asteroidBeltStory,
    initialState: {
      force_seed: asteroidBeltStory,
      star: {
        radius: 50.0,
        id: star_ref_id,
      },
      planets: [],
      asteroids: [],
      asteroid_belts: [
        {
          id: ReferencableIdBuilder.ReferencableIdReference({
            reference: 'belt',
          }),
          radius: 100,
          count: 100,
          width: 10.0,
          full_period_ticks: genPeriod('belt', 10.0),
        },
      ],
    },
    initialPos: {
      x: 100,
      y: 100,
    },
    initialZoom: 0.8,
  };
};
export const AsteroidBelt = FunctionalStoryTemplate.bind({});
AsteroidBelt.args = {
  storyName: asteroidBeltStory,
};
getStartGameParams[asteroidBeltStory] = getStartGameParamsAsteroidBelt;

export default {
  title: 'Functional/Celestial',
  argTypes: {},
} as Meta;
