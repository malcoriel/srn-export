import {
  createStateWithAShip,
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
    },
    rotation_rad: 0,
    radius: 1.0,
    velocity: {
      x: 0,
      y: 0,
    },
  },
  movement: {
    tag: 'RadialMonotonous',
    full_period_ticks: 120 * 1000 * 1000,
    phase: 0,
    clockwise: false,
    relative_position: {
      x: 0,
      y: 0,
    },
    start_phase: 0,
    anchor: {
      tag: 'Star',
      id: starId,
    },
  },
  rot_movement: {
    tag: 'None',
  },
  anchor_tier: 1, // 1 for planets, 2 for moons
  color: '#0D57AC',
  health: null,
  properties: [],
});

export const forceSetBodyPosition = (body, position) => {
  body.spatial.position = position;
  // if the position is set artificially, phase hint becomes invalid and has to be force-recalculated
  if (body.movement && !_.isNil(body.movement.phase)) {
    body.movement.phase = null;
  }
  if (body.movement && !_.isNil(body.movement.relative_position)) {
    body.movement.relative_position = null;
  }
};

export const forceSetBodyRotation = (body, rotation) => {
  body.spatial.rotation_rad = rotation;
  // if the position is set artificially, phase hint becomes invalid and has to be force-recalculated
  if (body.rot_movement && !_.isNil(body.rot_movement.phase)) {
    body.rot_movement.phase = null;
  }
};

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
    shipB.spatial.position.x += 10;
    shipB.spatial.position.y += 10;
    const targetShipX_05 = lerp(
      shipA.spatial.position.x,
      shipB.spatial.position.x,
      0.5
    );
    const targetShipY_05 = lerp(
      shipA.spatial.position.y,
      shipB.spatial.position.y,
      0.5
    );
    const stateC = wasm.interpolateStates(
      roomA.state,
      roomB.state,
      0.5,
      mockUpdateOptions()
    );
    const shipC = getShipByPlayerId(stateC, playerId);
    expect(shipC.spatial.position.x).toBeCloseTo(targetShipX_05);
    expect(shipC.spatial.position.y).toBeCloseTo(targetShipY_05);

    const stateD = wasm.interpolateStates(
      roomA.state,
      roomB.state,
      0.7,
      mockUpdateOptions()
    );
    const targetShipX_07 = lerp(
      shipA.spatial.position.x,
      shipB.spatial.position.x,
      0.7
    );
    const targetShipY_07 = lerp(
      shipA.spatial.position.y,
      shipB.spatial.position.y,
      0.7
    );
    const shipD = getShipByPlayerId(stateD, playerId);
    expect(shipD.spatial.position.x).toBeCloseTo(targetShipX_07);
    expect(shipD.spatial.position.y).toBeCloseTo(targetShipY_07);
  });

  it('can interpolate planet orbit movement', () => {
    const roomA = wasm.createRoom({
      mode: 'PirateDefence',
      seed: 'interpolate',
    });
    const planetA = getLoc0(roomA.state).planets[0];
    forceSetBodyPosition(planetA, {
      x: 100,
      y: 0,
    });
    const roomB = _.cloneDeep(roomA);
    const planetB = getLoc0(roomB.state).planets[0];
    forceSetBodyPosition(planetB, {
      x: 0,
      y: 100,
    });
    const stateC = wasm.interpolateStates(
      roomA.state,
      roomB.state,
      0.5,
      mockUpdateOptions()
    );
    const planetC = getLoc0(stateC).planets[0];
    expect(planetC.spatial.position.x).toBeCloseTo((Math.sqrt(2) / 2) * 100, 1);
    expect(planetC.spatial.position.y).toBeCloseTo((Math.sqrt(2) / 2) * 100, 1);
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
    forceSetBodyPosition(planetA, {
      x: 100,
      y: 0,
    });
    const roomB = _.cloneDeep(roomA);
    const planetB = getLoc0(roomB.state).planets[0];
    forceSetBodyPosition(planetB, {
      x: 0,
      y: -100,
    });
    const stateC = wasm.interpolateStates(
      roomA.state,
      roomB.state,
      0.5,
      mockUpdateOptions()
    );
    const planetC = getLoc0(stateC).planets[0];
    expect(planetC.spatial.position.x).toBeCloseTo((Math.sqrt(2) / 2) * 100, 1);
    expect(planetC.spatial.position.y).toBeCloseTo(
      -(Math.sqrt(2) / 2) * 100,
      1
    );
  });

  it('can interpolate moon orbit movement', () => {
    const roomA = wasm.createRoom({
      mode: 'PirateDefence',
      seed: 'interpolate',
    });
    const planet = mockPlanet(getLoc0(roomA.state).star.id);
    forceSetBodyPosition(planet, {
      x: 100,
      y: 0,
    });
    planet.name = 'planet';
    const moon = mockPlanet();
    forceSetBodyPosition(moon, {
      x: 120,
      y: 0,
    });
    moon.anchor_tier = 2;
    moon.movement.anchor = {
      tag: 'Planet',
      id: planet.id,
    };
    moon.name = 'moon';
    getLoc0(roomA.state).planets = [planet, moon];
    const roomB = _.cloneDeep(roomA);
    const planetB = getLoc0(roomB.state).planets[0];
    forceSetBodyPosition(planetB, {
      x: 0,
      y: 100,
    });
    const moonB = getLoc0(roomB.state).planets[1];
    forceSetBodyPosition(moonB, {
      x: -20,
      y: 100,
    });

    const stateC = wasm.interpolateStates(
      roomA.state,
      roomB.state,
      0.5,
      mockUpdateOptions()
    );
    const moonC = getLoc0(stateC).planets[1];
    expect(moonC.spatial.position.y).toBeCloseTo(
      (Math.sqrt(2) / 2) * 100 + 20,
      0
    );
    expect(moonC.spatial.position.x).toBeCloseTo((Math.sqrt(2) / 2) * 100, 0);
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

  it('interpolation matches extrapolation', () => {
    const STEP_MS = 1000;
    const state = wasm.seedWorld({
      mode: 'CargoRush',
      seed: 'int + exp',
    });
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
          intPlanet.spatial.position.x,
          0
        );
        expect(expPlanet.spatial.position.y).toBeCloseTo(
          intPlanet.spatial.position.y,
          0
        );
      }
    }
  });

  it('can interpolate ship movement approaching navigation end correctly', () => {
    const { state, ship } = createStateWithAShip('Sandbox');
    const speed = ship.movement_definition.move_speed;
    const start = state.ticks;
    const end = start + 5 * 1000 * 1000;
    const ratio = 0.2;
    const arrival_diff = (end - start) * ratio;
    const distance_diff = arrival_diff * speed;
    ship.spatial.position.x = 100;
    ship.spatial.position.y = 100;
    const newPos = {
      x: ship.spatial.position.x,
      y: ship.spatial.position.y,
    };
    newPos.x += distance_diff;
    ship.navigate_target = newPos;
    const stateB = _.cloneDeep(state);
    stateB.locations[0].ships[0].x = newPos.x;
    stateB.player_actions = [];
    stateB.ticks = end;
    const stateC = wasm.interpolateStates(
      state,
      stateB,
      ratio,
      mockUpdateOptions()
    );
    const newShipPosX = stateC.locations[0].ships[0].spatial.position.x;
    expect(newShipPosX).toBeCloseTo(newPos.x);
  });

  it('can interpolate asteroid belt rotation', () => {
    const state = wasm.seedWorld({
      mode: 'CargoRush',
      seed: 'belt interpolate',
    });
    state.locations[0].asteroid_belts[0].rot_movement.full_period_ticks = Math.abs(
      state.locations[0].asteroid_belts[0].rot_movement.full_period_ticks // guarantee positive
    );
    forceSetBodyRotation(state.locations[0].asteroid_belts[0], 0.0);
    const stateB = _.cloneDeep(state);
    stateB.ticks +=
      stateB.locations[0].asteroid_belts[0].rot_movement.full_period_ticks / 4;
    forceSetBodyRotation(stateB.locations[0].asteroid_belts[0], Math.PI / 2);
    const stateC = wasm.interpolateStates(
      state,
      stateB,
      0.5,
      mockUpdateOptions()
    );
    const beltC = stateC.locations[0].asteroid_belts[0];
    expect(beltC.spatial.rotation_rad).toBeCloseTo(Math.PI / 4);
  });
});
