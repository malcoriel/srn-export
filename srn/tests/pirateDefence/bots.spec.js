import { updateRoom, wasm, swapGlobals } from '../util';
import _ from 'lodash';

describe('pirate defence bots behavior', () => {
  beforeAll(swapGlobals);
  it('can spawn some default bots', async () => {
    const room = wasm.createRoom({ mode: 'PirateDefence' });
    const { state: world } = room;
    expect(world.players.length).toBeGreaterThan(0);
    expect(_.every(world.players, (p) => p.is_bot)).toBeTruthy();
  });

  it('npcs damage the planets after some time', async () => {});

  it('bots shoot npcs', () => {});
});
