import {
  getLoc0,
  getShipByPlayerId,
  mockUpdateOptions,
  swapGlobals,
  updateWorld,
  wasm,
} from '../util';
import _ from 'lodash';
import * as uuid from 'uuid';

const lerp = (x, y, a) => x + (y - x) * a;

export const mockPlanet = (starId) => ({
  id: uuid.v4(),
  name: 'mock',
  spatial: {
    position: {
      x: 0,
      y: 0,
      rotation_rad: 0,
      radius: 1.0,
    },
  },
  movement: {
    tag: 'RadialMonotonous',
    full_period_ticks: 60 * 1000 * 1000,
    phase: 0,
    clockwise: false,
    relative_position: { x: 0, y: 0 },
    start_phase: 0,
    anchor: {
      tag: 'Star',
      id: starId,
    },
  },
  anchor_tier: 1, // 1 for planets, 2 for moons
  color: '#0D57AC',
  health: null,
  properties: [],
});

describe('state interpolation', () => {
  beforeAll(swapGlobals);
  it('can interpolate ship direct movement', () => {
    const roomA = wasm.createRoom({
      mode: 'PirateDefence',
      seed: 'interpolate',
    });
    const roomB = _.cloneDeep(roomA);
    const playerId = roomA.state.players[0].id;
    const shipA = getShipByPlayerId(roomA.state, playerId);
    const shipB = getShipByPlayerId(roomB.state, playerId);
    shipB.x += 10;
    shipB.y += 10;
    const targetShipX_05 = lerp(shipA.x, shipB.x, 0.5);
    const targetShipY_05 = lerp(shipA.y, shipB.y, 0.5);
    const stateC = wasm.interpolateStates(
      roomA.state,
      roomB.state,
      0.5,
      mockUpdateOptions()
    );
    const shipC = getShipByPlayerId(stateC, playerId);
    expect(shipC.x).toBeCloseTo(targetShipX_05);
    expect(shipC.y).toBeCloseTo(targetShipY_05);

    const stateD = wasm.interpolateStates(
      roomA.state,
      roomB.state,
      0.7,
      mockUpdateOptions()
    );
    const targetShipX_07 = lerp(shipA.x, shipB.x, 0.7);
    const targetShipY_07 = lerp(shipA.y, shipB.y, 0.7);
    const shipD = getShipByPlayerId(stateD, playerId);
    expect(shipD.x).toBeCloseTo(targetShipX_07);
    expect(shipD.y).toBeCloseTo(targetShipY_07);
  });

  it('can interpolate planet orbit movement', () => {
    const roomA = wasm.createRoom({
      mode: 'PirateDefence',
      seed: 'interpolate',
    });
    const planetA = getLoc0(roomA.state).planets[0];
    planetA.spatial.position.x = 100;
    planetA.spatial.position.y = 0;
    const roomB = _.cloneDeep(roomA);
    const planetB = getLoc0(roomB.state).planets[0];
    planetB.spatial.position.x = 0;
    planetB.spatial.position.y = 100;
    const stateC = wasm.interpolateStates(
      roomA.state,
      roomB.state,
      0.5,
      mockUpdateOptions()
    );
    const planetC = getLoc0(stateC).planets[0];
    expect(planetC.spatial.position.x).toBeCloseTo((Math.sqrt(2) / 2) * 100);
    expect(planetC.spatial.position.y).toBeCloseTo((Math.sqrt(2) / 2) * 100);
    // extra call to check caching (manually)
    // console.log('extra call to interpolate to check cache');
    // wasm.interpolateStates(roomA.state, roomB.state, 0.5);
  });

  it('interpolates via shortest path, even if the orbit indexes are not close', () => {
    const roomA = wasm.createRoom({
      mode: 'PirateDefence',
      seed: 'interpolate',
    });
    const planetA = getLoc0(roomA.state).planets[0];
    planetA.spatial.position.x = 100;
    planetA.spatial.position.y = 0;
    const roomB = _.cloneDeep(roomA);
    const planetB = getLoc0(roomB.state).planets[0];
    planetB.spatial.position.x = 0;
    planetB.spatial.position.y = -100;
    const stateC = wasm.interpolateStates(
      roomA.state,
      roomB.state,
      0.5,
      mockUpdateOptions()
    );
    const planetC = getLoc0(stateC).planets[0];
    expect(planetC.spatial.position.x).toBeCloseTo((Math.sqrt(2) / 2) * 100);
    expect(planetC.spatial.position.y).toBeCloseTo(-(Math.sqrt(2) / 2) * 100);
  });

  it('can interpolate moon orbit movement', () => {
    const roomA = wasm.createRoom({
      mode: 'PirateDefence',
      seed: 'interpolate',
    });
    const planet = mockPlanet();
    planet.anchor_id = getLoc0(roomA.state).star.id;
    planet.spatial.position.x = 100;
    planet.spatial.position.y = 0;
    planet.name = 'planet';
    const moon = mockPlanet();
    moon.spatial.position.x = 120;
    moon.spatial.position.y = 0;
    moon.anchor_tier = 2;
    moon.anchor_id = planet.id;
    moon.name = 'moon';
    getLoc0(roomA.state).planets = [planet, moon];
    const roomB = _.cloneDeep(roomA);
    const planetB = getLoc0(roomB.state).planets[0];
    planetB.spatial.position.x = 0;
    planetB.spatial.position.y = 100;
    const moonB = getLoc0(roomB.state).planets[1];
    moonB.spatial.position.x = -20;
    moonB.spatial.position.y = 100;

    const stateC = wasm.interpolateStates(
      roomA.state,
      roomB.state,
      0.5,
      mockUpdateOptions()
    );
    const moonC = getLoc0(stateC).planets[1];
    expect(moonC.spatial.position.y).toBeCloseTo((Math.sqrt(2) / 2) * 100 + 20);
    expect(moonC.spatial.position.x).toBeCloseTo((Math.sqrt(2) / 2) * 100);
  });

  xit('can interpolate only limited area', () => {
    const worldA = wasm.seedWorld({
      mode: 'PirateDefence',
      seed: 'interpolate',
    });
    const planet = mockPlanet();
    planet.anchor_id = getLoc0(worldA).star.id;
    planet.spatial.position.x = 100;
    planet.spatial.position.y = 0;
    planet.anchor_tier = 1;
    planet.name = 'planet';
    const moon = mockPlanet();
    moon.spatial.position.x = 120;
    moon.spatial.position.y = 0;
    moon.anchor_tier = 2;
    moon.anchor_id = planet.id;
    moon.name = 'moon';
    getLoc0(worldA).planets = [planet, moon];
    const worldB = _.cloneDeep(worldA);
    const planetB = getLoc0(worldB).planets[0];
    planetB.x = 60; // not really a correct trajectory, but interpolation doesn't care - it's going to pick up the closest trajectory point regardless
    planetB.y = -60;
    const moonB = getLoc0(worldB).planets[1];
    moonB.x = 0; // let's go crazy so interpolation also would go crazy if it picks it up
    moonB.y = 100;
    const worldC = wasm.interpolateStates(
      worldA,
      worldB,
      0.5,
      mockUpdateOptions({
        limit_area: {
          top_left: {
            x: 98,
            y: -2,
          },
          bottom_right: {
            x: 101,
            y: 1,
          },
        },
      })
    );
    const planetC = getLoc0(worldC).planets[0];
    const moonC = getLoc0(worldC).planets[0];
    // expect moon to be skipped from update, but not the planet
    expect(planetC.spatial.position.x).not.toBeCloseTo(100);
    expect(moonC.spatial.position.x).toBeCloseTo(120);
  });

  xit('interpolation matches extrapolation', () => {
    const STEP_MS = 1000;
    const state = wasm.seedWorld({ mode: 'CargoRush', seed: 'int + exp' });
    const planetCount = state.locations[0].planets.length;
    for (let i = 0; i < 10; i++) {
      const currentTimestamp = i * STEP_MS;
      const nextTimestamp = (i + 1) * STEP_MS;
      const fullDistance = nextTimestamp - currentTimestamp;
      const halfDistance = fullDistance / 2;
      const stateExpHalf = updateWorld(state, halfDistance);
      const stateExpFull = updateWorld(state, fullDistance);
      const stateIntHalf = wasm.interpolateStates(
        state,
        stateExpFull,
        0.5,
        mockUpdateOptions()
      );
      for (let i = 0; i < planetCount; ++i) {
        const expPlanet = stateExpHalf.locations[0].planets[i];
        const intPlanet = stateIntHalf.locations[0].planets[i];
        expect(expPlanet.spatial.position.x).toBeCloseTo(
          intPlanet.spatial.position.x
        );
        expect(expPlanet.spatial.position.y).toBeCloseTo(intPlanet.spatial.y);
      }
    }
  });
});
