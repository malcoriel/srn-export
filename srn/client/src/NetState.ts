import EventEmitter from 'events';
import { applyShipAction, GameState, ShipAction } from './world';
import Vector from './Vector';

enum OpCode {
  Unknown,
  Sync,
  MutateMyShip,
  Name,
}

interface Cmd {
  code: OpCode;
  value: any;
}

const FORCE_SYNC_INTERVAL = 1000;
const RECONNECT_INTERVAL = 1000;

export const findMyPlayer = (state: GameState) =>
  state.players.find((player) => player.id === state.my_id);

export const findMyShipIndex = (state: GameState): number | null => {
  const myPlayer = findMyPlayer(state);
  if (!myPlayer) return null;

  const foundShipIndex = state.ships.findIndex(
    (ship) => ship.id === myPlayer.ship_id
  );
  if (foundShipIndex == -1) return null;
  return foundShipIndex;
};

export default class NetState extends EventEmitter {
  private socket: WebSocket | null = null;
  state!: GameState;
  public connecting = true;
  public preferredName = 'player';
  private localSimUpdate:
    | ((serialized_state: string, elapsed_micro: BigInt) => string)
    | undefined;
  constructor() {
    super();
    this.state = {
      planets: [],
      players: [],
      ships: [],
      tick: 0,
      my_id: '',
      // @ts-ignore
      star: null,
    };
    setInterval(this.forceSync, FORCE_SYNC_INTERVAL);
  }

  forceSync = () => {
    if (!this.connecting) {
      this.state.ticks = 0;
      this.send({ code: OpCode.Sync, value: null });
    }
  };

  connect = () => {
    this.socket = new WebSocket('ws://192.168.0.10:2794', 'rust-websocket');
    this.socket.onmessage = (event) => {
      this.handleMessage(event.data);
    };
    this.socket.onclose = () => {
      this.emit('network');
      this.socket = null;
      this.state.ticks = 0;
      setTimeout(() => {
        this.connecting = true;
        this.connect();
      }, RECONNECT_INTERVAL);
    };
    this.socket.onopen = () => {
      this.connecting = false;
      this.send({ code: OpCode.Name, value: this.preferredName });
      // noinspection JSIgnoredPromiseFromCall
      this.initLocalSim();
    };
    this.socket.onerror = () => {
      console.warn('socket error');
      this.emit('network');
      if (this.socket) {
        this.socket.close();
      }
    };
  };

  private handleMessage(data: string) {
    try {
      const parsed = JSON.parse(data);
      if (
        parsed.ticks > this.state.ticks ||
        parsed.start_time_ticks != this.state.start_time_ticks
      ) {
        this.state = parsed;
        this.emit('change', this.state);
      }
    } catch (e) {
      console.warn('error handling message', e);
    }
  }

  private send(cmd: Cmd) {
    if (this.socket && !this.connecting) {
      switch (cmd.code) {
        case OpCode.Sync: {
          this.socket.send(`${cmd.code}_%_`);
          break;
        }
        case OpCode.MutateMyShip: {
          this.socket.send(`${cmd.code}_%_${JSON.stringify(cmd.value)}`);
          break;
        }
        case OpCode.Name: {
          this.socket.send(`${cmd.code}_%_${cmd.value}`);
          break;
        }
      }
    }
  }

  mutate_ship = (cmd: ShipAction) => {
    const myShipIndex = findMyShipIndex(this.state);
    if (myShipIndex === -1 || myShipIndex === null) return;
    const myShip = this.state.ships.splice(myShipIndex, 1)[0];
    const newShip = applyShipAction(myShip, cmd, this.state);
    this.state.ships.push(myShip);
    this.emit('change', this.state);
    this.send({ code: OpCode.MutateMyShip, value: newShip });
  };

  onPreferredNameChange = (newName: string) => {
    this.preferredName = newName;
  };

  private async initLocalSim() {
    const { update, set_panic_hook } = await import('../../world/pkg');
    // @ts-ignore
    window.testUpdate = () => {
      const initial = {
        my_id: 'a023dad9-44ad-4a7b-9f4b-8e6985d21fea',
        star: {
          id: '9156ac55-e9c4-4280-a505-cfe5388990ea',
          name: 'Zinides',
          x: 0.0,
          y: 0.0,
          radius: 10.0,
          rotation: 0.0,
          color: '#f08537',
        },
        planets: [
          {
            id: 'ea9e50fd-b667-4dcb-8ed7-941114912d4c',
            name: 'Robrapus',
            x: 6.880198804531867,
            y: -13.329023385459202,
            rotation: 0.0,
            radius: 1.5,
            orbit_speed: 0.05,
            anchor_id: '9156ac55-e9c4-4280-a505-cfe5388990ea',
            anchor_tier: 1,
            color: 'orange',
          },
          {
            id: '83db8d1b-1555-4bee-adb1-3605a14203f0',
            name: 'Dabayama',
            x: -6.250918863881845,
            y: 17.942296769286983,
            rotation: 0.0,
            radius: 2.0,
            orbit_speed: 0.2,
            anchor_id: '9156ac55-e9c4-4280-a505-cfe5388990ea',
            anchor_tier: 1,
            color: 'blue',
          },
          {
            id: 'b2b45917-b7df-4a63-b623-085e3b568c4f',
            name: 'D1',
            x: 19.426467730743312,
            y: -28.30293259559134,
            rotation: 0.0,
            radius: 1.5,
            orbit_speed: 0.3,
            anchor_id: 'e69584a6-a2a9-4208-925f-dd78d7d1075d',
            anchor_tier: 2,
            color: 'gray',
          },
          {
            id: '565b721c-bc99-493f-9b3f-90b8901053a8',
            name: 'D2',
            x: 14.197618433464436,
            y: -34.94652298495862,
            rotation: 0.0,
            radius: 1.2,
            orbit_speed: 0.5,
            anchor_id: 'e69584a6-a2a9-4208-925f-dd78d7d1075d',
            anchor_tier: 2,
            color: 'gray',
          },
          {
            id: '588a5b30-1477-43ec-a353-ea0e1b19dcda',
            name: 'Eustea',
            x: -23.16901845693094,
            y: -32.60669538212043,
            rotation: 0.0,
            radius: 2.0,
            orbit_speed: 0.1,
            anchor_id: '9156ac55-e9c4-4280-a505-cfe5388990ea',
            anchor_tier: 1,
            color: 'greenyellow',
          },
          {
            id: 'e69584a6-a2a9-4208-925f-dd78d7d1075d',
            name: 'Sunov',
            x: 13.760397609063734,
            y: -26.658046770918403,
            rotation: 0.0,
            radius: 3.0,
            orbit_speed: 0.05,
            anchor_id: '9156ac55-e9c4-4280-a505-cfe5388990ea',
            anchor_tier: 1,
            color: 'orange',
          },
        ],
        ships: [],
        players: [],
        tick: 0,
        milliseconds_remaining: 180000,
        paused: false,
        leaderboard: null,
      };
      const first_expected = {
        id: '11484fa8-7883-421f-b573-b3c9ef31fb4b',
        name: 'Robrapus',
        x: 6.8793184075301115,
        y: -13.329477793515297,
        rotation: 0.0,
        radius: 1.5,
        orbit_speed: 0.05,
        anchor_id: '17a435a9-5856-462d-98f9-5dd7874df9e4',
        anchor_tier: 1,
        color: 'orange',
      };
      const result = update(JSON.stringify(initial), 1321n);
      let planet = JSON.parse(result).planets[0];
      console.log(
        Vector.fromIVector(planet).toKey(),
        'vs',
        Vector.fromIVector(first_expected).toKey()
      );
    };
    set_panic_hook();
    this.localSimUpdate = update;
  }

  updateLocalState(elapsedMs: number) {
    if (!this.localSimUpdate) {
      return;
    }
    let updated = this.localSimUpdate(
      JSON.stringify(this.state),
      BigInt(elapsedMs * 1000)
    );
    if (updated) {
      let result = JSON.parse(updated);
      if (!result.message) {
        this.state = result;
      } else {
        console.warn(result.message);
      }
    }
  }
}
