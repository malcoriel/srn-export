import { getLoc0, getShipByPlayerId, loadWasm, wasm } from '../util';
import _ from 'lodash';
import * as uuid from 'uuid';

const lerp = (x, y, a) => x + (y - x) * a;

export const mockPlanet = () => ({
  id: uuid.v4(),
  name: 'mock',
  x: 0,
  y: 0,
  rotation: 0,
  radius: 1.0,
  orbit_speed: 0.1, // technically invalid, but it's intended to be set by the test
  anchor_id: uuid.v4(), // also invalid, should be set
  anchor_tier: 1, // 1 for planets, 2 for moons
  color: '#0D57AC',
  health: null,
  properties: [],
});

describe('state interpolation', () => {
  beforeAll(loadWasm);
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
    const stateC = wasm.interpolateStates(roomA.state, roomB.state, 0.5);
    const shipC = getShipByPlayerId(stateC, playerId);
    expect(shipC.x).toBeCloseTo(targetShipX_05);
    expect(shipC.y).toBeCloseTo(targetShipY_05);

    const stateD = wasm.interpolateStates(roomA.state, roomB.state, 0.7);
    const targetShipX_07 = lerp(shipA.x, shipB.x, 0.7);
    const targetShipY_07 = lerp(shipA.y, shipB.y, 0.7);
    const shipD = getShipByPlayerId(stateD, playerId);
    expect(shipD.x).toBeCloseTo(targetShipX_07);
    expect(shipD.y).toBeCloseTo(targetShipY_07);
  });

  fit('can interpolate planet orbit movement', () => {
    const roomA = wasm.createRoom({
      mode: 'PirateDefence',
      seed: 'interpolate',
    });
    const planetA = getLoc0(roomA.state).planets[0];
    planetA.x = 100;
    planetA.y = 0;
    const roomB = _.cloneDeep(roomA);
    const planetB = getLoc0(roomB.state).planets[0];
    planetB.x = 0;
    planetB.y = 100;
    const stateC = wasm.interpolateStates(roomA.state, roomB.state, 0.5);
    const planetC = getLoc0(stateC).planets[0];
    expect(planetC.x).toBeCloseTo((Math.sqrt(2) / 2) * 100);
    expect(planetC.y).toBeCloseTo((Math.sqrt(2) / 2) * 100);
    // extra call to check caching (manually)
    // console.log('extra call to interpolate to check cache');
    // wasm.interpolateStates(roomA.state, roomB.state, 0.5);
  });

  fit('interpolates via shortest path, even if the orbit indexes are not close', () => {
    const roomA = wasm.createRoom({
      mode: 'PirateDefence',
      seed: 'interpolate',
    });
    const planetA = getLoc0(roomA.state).planets[0];
    planetA.x = 100;
    planetA.y = 0;
    const roomB = _.cloneDeep(roomA);
    const planetB = getLoc0(roomB.state).planets[0];
    planetB.x = 0;
    planetB.y = -100;
    const stateC = wasm.interpolateStates(roomA.state, roomB.state, 0.5);
    const planetC = getLoc0(stateC).planets[0];
    expect(planetC.x).toBeCloseTo((Math.sqrt(2) / 2) * 100);
    expect(planetC.y).toBeCloseTo(-(Math.sqrt(2) / 2) * 100);
  });

  // it('can interpolate moon orbit movement', () => {
  //   const roomA = wasm.createRoom({
  //     mode: 'PirateDefence',
  //     seed: 'interpolate',
  //   });
  //   const planet = mockPlanet();
  //   planet.anchor_id = roomA.state.star.id;
  //   planet.x = 100;
  //   planet.y = 0;
  //   const moon = mockPlanet();
  //   moon.x = 120;
  //   moon.y = 0;
  //   moon.anchor_id = planet.id;
  //   getLoc0(roomA.state).planets = [planet, moon];
  //   const roomB = _.cloneDeep(roomA);
  //   const planetB = getLoc0(roomB.state).planets[0];
  //   planetB.
  //   const moonB = getLoc0(roomB.state).planets[1];
  //
  //   const stateC = wasm.interpolateStates(roomA.state, roomB.state, 0.5);
  // });
});
