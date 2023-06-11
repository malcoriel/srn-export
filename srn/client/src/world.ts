import Vector, { IVector } from './utils/Vector';
import {
  Action,
  ActionGas,
  ActionMoveAxis,
  ActionReverse,
  ActionTurnLeft,
  ActionTurnRight,
  Asteroid,
  AsteroidBelt,
  Dialogue,
  DialogueElem,
  FullObjectSpecifier,
  GameState,
  Health,
  InventoryItem,
  Leaderboard,
  Location,
  Market,
  NatSpawnMineral,
  Notification,
  NotificationText,
  ObjectSpecifier,
  PlanetV2,
  Player,
  Price,
  Quest,
  Ship,
  Star,
  Substitution,
  TradeAction,
} from '../../world/pkg';
import {
  CargoDeliveryQuestState,
  GameMode,
  InventoryItemType,
  SubstitutionType,
} from '../../world/pkg/world.extra';
import _ from 'lodash';
import { Dictionary } from 'ts-essentials';
import * as uuid from 'uuid';
import Prando from 'prando';
import { api } from './utils/api';
import { Measure, Perf } from './HtmlLayers/Perf';
import pWaitFor from 'p-wait-for';

export type {
  Action,
  Notification,
  NotificationText,
  NatSpawnMineral,
  Asteroid,
  AsteroidBelt,
  PlanetV2,
  Ship,
  Star,
  Quest,
  Player,
  ObjectSpecifier,
  Leaderboard,
  Dialogue,
  Substitution,
  DialogueElem,
  InventoryItem,
  TradeAction,
  Price,
  Market,
  GameState,
  FullObjectSpecifier,
  Location,
};
export {
  CargoDeliveryQuestState,
  SubstitutionType,
  InventoryItemType,
  GameMode,
};
// noinspection JSUnusedGlobalSymbols
export const width_units = 1000;
// noinspection JSUnusedGlobalSymbols
export const height_units = 1000;
export const max_x = width_units / 2;
export const max_y = height_units / 2;
export const min_x = -max_x;
// noinspection JSUnusedGlobalSymbols
export const min_y = -max_y;

export type AABB = {
  top_left: Vector;
  bottom_right: Vector;
};

export const MaxedAABB = {
  top_left: Vector.fromIVector({
    x: min_x,
    y: min_y,
  }),
  bottom_right: Vector.fromIVector({
    x: max_x,
    y: max_y,
  }),
};

export enum PlanetType {
  Unknown = 'Unknown',
  Ice = 'Ice',
  Jovian = 'Jovian',
  Jungle = 'Jungle',
  Barren = 'Barren',
}

export enum SandboxTeleportTarget {
  Unknown = 'Unknown',
  Zero = 'Zero',
}

export const isStateTutorial = (st: GameState) => {
  return st.mode === GameMode.Tutorial;
};

export enum Direction {
  Unknown,
  Up,
  UpRight,
  Right,
  DownRight,
  Down,
  DownLeft,
  Left,
  UpLeft,
}

const directionToRotation = {
  [Direction.Unknown]: 0,
  [Direction.Up]: 0,
  [Direction.UpRight]: Math.PI / 4,
  [Direction.Right]: Math.PI / 2,
  [Direction.UpLeft]: -Math.PI / 4,
  [Direction.Left]: -Math.PI / 2,
  [Direction.DownLeft]: -Math.PI * 0.75,
  [Direction.Down]: Math.PI,
  [Direction.DownRight]: Math.PI * 0.75,
};

export const TRACTOR_DIST = 30;

export const findMineral = (state: GameState, min_id: string) => {
  return state.locations[0].minerals.find((m) => m.id === min_id);
};

export const findContainer = (state: GameState, cont_id: string) => {
  return state.locations[0].containers.find((c) => c.id === cont_id);
};

let wasmFunctions: any = {};

const PERF_FLUSH_INTERVAL_MS = 30 * 1000;
let lastEnablePerf = false;

const forceEnablePerfRecheck = () => {
  // @ts-ignore
  const newEnablePerf = !!window.ENABLE_PERF;
  if (lastEnablePerf !== newEnablePerf) {
    console.warn(
      `ENABLE_PERF changed to ${newEnablePerf}.` +
        'Beware that it will only work before any updateWorld calls, ' +
        'so basically you can only call it before starting any game and cannot disable afterwards.' +
        'Restart the whole app to disable it'
    );
    wasmFunctions.set_enable_perf(newEnablePerf);
    if (newEnablePerf && !lastEnablePerf) {
      // last part of condition is redundant, but is here for readability
      console.warn(
        `Performance stats will be flushed at most after ${PERF_FLUSH_INTERVAL_MS}ms`
      );
    }
    lastEnablePerf = newEnablePerf;
  }
};

// @ts-ignore
window.enablePerf = () => {
  // @ts-ignore
  window.ENABLE_PERF = 1;
  forceEnablePerfRecheck();
};

let wasmLoading = true;
(async function initWorldWasm() {
  console.log('loading world wasm....');
  wasmFunctions = await import('../../world/pkg');
  // jest would complain otherwise, due to the hack with resolver that I had to do
  // the world/pkg/world_bg.js does not get imported when this file (world.ts) is imported via jest
  if (wasmFunctions && wasmFunctions.set_panic_hook) {
    wasmFunctions.set_panic_hook();
  }
  // auto-sync global variable enable perf to enable/disable performance metrics manually
  setInterval(() => {
    if (lastEnablePerf) {
      wasmFunctions.flush_sampler_stats();
    }
    forceEnablePerfRecheck();
  }, PERF_FLUSH_INTERVAL_MS);
  console.log('loading world wasm done.');
  wasmLoading = false; // no need for .finally, app cannot recover from it
  wasmFunctions.self_inspect();
  // @ts-ignore
  window.getNanosWeb = wasmFunctions.get_nanos_web;
})();

export const waitForWasmLoad = async () => {
  await pWaitFor(() => !wasmLoading, { timeout: 10000 });
};

// the dialogue table type is intentionally opaque here, as it's passed from server to lib through js
export const initDialogueTable = (dialogueTable: any) => {
  if (wasmFunctions && wasmFunctions.load_d_table) {
    try {
      wasmFunctions.load_d_table(dialogueTable);
    } catch (e) {
      console.error(
        'Cannot init dialogue table, dialogues will crash! Error loading: ',
        e
      );
    }
  } else {
    console.error(
      'Cannot init dialogue table, wasm is not initialized yet, dialogues will crash!'
    );
  }
};

let isLoadingDialogueTable = false;
let dialogueTable: unknown;
export const ensureDialogueTableLoaded = async () => {
  try {
    if (!dialogueTable) {
      isLoadingDialogueTable = true;
      dialogueTable = await api.getDialogueTable();
      initDialogueTable(dialogueTable);
    }
  } finally {
    isLoadingDialogueTable = false;
  }
};

const exposeJsonParseError = (
  serializedState: string,
  resultMessage: string
) => {
  const match = resultMessage.match(/at line (\d+) column (\d+)/);

  if (match) {
    const lines = serializedState.split('\n');
    const lineNumber = Number(match[1]);

    console.log(
      lines[lineNumber - 3] || '',
      '\n',
      lines[lineNumber - 2] || '',
      '\n',
      'here ----> ',

      lines[lineNumber - 1] || '',
      '\n',
      lines[lineNumber],
      '\n',
      lines[lineNumber + 1] || '',
      '\n',
      lines[lineNumber + 2] || '',
      '\n',
      lines[lineNumber + 3] || '',
      '\n'
    );
  }
};

export const rawUpdateWorld = (...args: any[]) => {
  return wasmFunctions.update_world(...args);
};

export const updateWorld = (
  {
    state,
    limit_area,
    client,
    state_tag,
  }: {
    state: GameState;
    limit_area: AABB;
    client: boolean;
    state_tag: string | undefined;
  },
  elapsedTicks: number
): GameState | undefined => {
  return wasmFunctions.update_world(
    { state, limit_area, client, state_tag },
    elapsedTicks
  );
};

export const updateWorldIncremental = (
  {
    state_tag,
    limit_area,
    client,
  }: { state_tag: string; limit_area: AABB; client: boolean },
  elapsedTicks: number
): GameState | undefined => {
  return wasmFunctions.update_world_incremental(
    { state_tag, limit_area, client },
    elapsedTicks
  );
};

export const interpolateWorld = (
  fromState: GameState,
  toState: GameState,
  value: number,
  limitArea: AABB
): GameState => {
  return wasmFunctions.interpolate_states(fromState, toState, value, {
    limit_area: limitArea,
    limit_to_loc_idx: 0,
  });
};

export const restoreReplayFrame = (
  prevTicks: number,
  nextTicks: number | null,
  currentTicks: number
): GameState | null => {
  if (nextTicks !== null) {
    return wasmFunctions.get_preloaded_diff_replay_state_at_interpolated(
      Math.round(prevTicks),
      Math.round(nextTicks),
      (currentTicks - prevTicks) / (nextTicks - prevTicks)
    );
  }
  return wasmFunctions.get_preloaded_diff_replay_state_at(
    Math.round(prevTicks)
  );
};

export const loadReplayIntoWasm = (replay: any) => {
  wasmFunctions.load_replay(replay);
};

export const buildDialogueFromState = (
  dialogueId: string,
  currentStateId: string,
  playerId: string,
  state: GameState
): null | Dialogue => {
  try {
    return wasmFunctions.build_dialogue_from_state(
      dialogueId,
      currentStateId,
      playerId,
      state
    );
  } catch (e) {
    console.error(e);
    return null;
  }
};

export const findPlanet = (
  state: GameState,
  id: string
): PlanetV2 | undefined => {
  return state.locations[0].planets.find((p) => p.id === id);
};

export const indexShipsByPlayerId = (
  loc: Location,
  players: Player[]
): Record<string, Ship> => {
  const playersByShip = _.keyBy(
    players,
    (p: Player) => p.ship_id
  ) as Dictionary<Player>;
  const res: Record<string, Ship> = {};
  for (const ship of loc.ships) {
    if (playersByShip[ship.id]) {
      res[playersByShip[ship.id].id] = ship;
    }
  }
  return res;
};

export const getSpecifierId = (os?: ObjectSpecifier | null): string | null => {
  if (!os || os.tag === 'Unknown') return null;
  return String(os.id) || null;
};

export type ManualMovementActionTags =
  | 'Gas'
  | 'Reverse'
  | 'TurnRight'
  | 'TurnLeft'
  | 'MoveAxis';

export type ManualMovementAction =
  | ActionGas
  | ActionReverse
  | ActionTurnRight
  | ActionMoveAxis
  | ActionTurnLeft;

export const ManualMovementInactivityDropMs = 500;

export const isManualMovement = (act: Action): act is ManualMovementAction => {
  return (
    act.tag === 'Gas' ||
    act.tag === 'Reverse' ||
    act.tag === 'TurnRight' ||
    act.tag === 'TurnLeft' ||
    act.tag === 'MoveAxis'
  );
};

export const normalizeHealth = (
  h: Health | null | undefined
): number | undefined => {
  return h ? h.current / h.max : undefined;
};

export const DEFAULT_STATE = {
  ticks: 0,
  gen_opts: {
    system_count: 0,
    max_planets_in_system: 10,
    max_satellites_for_planet: 3,
  },
  id: '',
  leaderboard: {
    rating: [],
    winner: '',
  },
  market: {
    prices: {},
    wares: {},
    time_before_next_shake: 0,
  },
  mode: GameMode.Unknown,
  seed: '',
  next_seed: null,
  tag: '',
  version: 0,
  locations: [
    {
      id: '',
      seed: '',
      planets: [],
      minerals: [],
      containers: [],
      asteroids: [],
      asteroid_belts: [],
      ships: [],
      adjacent_location_ids: [],
      star: null,
      position: new Vector(0, 0),
      wrecks: [],
      projectiles: [],
      projectile_counter: 0,
    },
  ],
  players: [],
  millis: 0,
  my_id: uuid.v4(),
  start_time_ticks: 0,
  milliseconds_remaining: 0,
  paused: true,
  interval_data: {},
  game_over: null,
  events: [],
  processed_events: [],
  player_actions: [],
  processed_player_actions: [],
  update_every_ticks: 9999,
  accumulated_not_updated_ticks: 0,
  dialogue_states: {},
  breadcrumbs: [],
  projectile_templates: [],
};

const periodPrimes = [7, 11, 13, 17, 19, 23];
export const genPeriod = (
  seed = new Date().valueOf().toString(),
  scale = 1.0
) => {
  const prng = new Prando(seed);
  const idx = Math.floor(prng.next(0, periodPrimes.length));
  const prime = periodPrimes[idx];
  const dir = prng.nextBoolean() ? 1 : -1;
  return dir * prime * 10 * 1000 * 1000 * scale * 2.0;
};
export const isInAABB = (
  bounds: AABB,
  obj: IVector,
  radius: number
): boolean => {
  return (
    bounds.top_left.x - radius <= obj.x &&
    obj.x <= bounds.bottom_right.x + radius &&
    bounds.top_left.y - radius <= obj.y &&
    obj.y <= bounds.bottom_right.y + radius
  );
};

export const getObjSpecId = (objSpec: ObjectSpecifier): string | null => {
  if (objSpec.tag === 'Unknown') {
    return null;
  }
  return String(objSpec.id);
};
