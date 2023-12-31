import {
  adjectives,
  animals,
  uniqueNamesGenerator,
} from 'unique-names-generator';
import create from 'zustand';
import { randBetweenExclusiveEnd } from './utils/rand';
import {
  deleteLSValue,
  extractLSValue,
  setLSValue,
} from './utils/useLocalStorage';
import { ObjectSpecifier } from '../../world/pkg';
import _ from 'lodash';

export function genRandomName() {
  return uniqueNamesGenerator({
    dictionaries: [adjectives, animals],
    separator: '-',
  }).toUpperCase();
}

export const portraits = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

export function portraitPath(portraitIndex: number) {
  return portraits[portraitIndex];
}

export enum WindowState {
  Unknown,
  Hidden,
  Shown,
  Minimized,
  ShownUnclosable,
  MinimizedUnclosable,
}

export enum MainUiState {
  Idle = 0,
  Playing = 1,
  Watching = 2,
}

export type SrnState = {
  mainUiState: MainUiState;
  setMainUiState: (value: MainUiState) => void;
  menu: boolean;
  skipMenu: boolean;
  setSkipMenu: (value: boolean) => void;
  setMenu: (value: boolean) => void;
  toggleMenu: () => void;
  preferredName: string;
  setPreferredName: (value: string) => void;
  makeRandomName: () => void;
  musicEnabled: boolean;
  setMusicEnabled: (value: boolean) => void;
  portrait: string;
  hotkeysPressed: Record<string, boolean>;
  hotkeyScope: string;

  setPortrait: (value: string) => void;
  nextPortrait: () => void;
  prevPortrait: () => void;
  trigger: number;
  forceUpdate: () => void;
  makeRandomPortrait: () => void;
  volume: number;
  setVolume: (val: number) => void;
  questWindow: WindowState;
  setQuestWindow: (val: WindowState) => void;
  setTradeWindow: (val: WindowState) => void;
  toggleQuestWindow: () => void;
  toggleHelpWindow: () => void;
  toggleChatWindow: () => void;
  toggleInventoryWindow: () => void;
  toggleMapWindow: () => void;
  toggleTradeWindow: () => void;
  toggleStatsWindow: () => void;
  helpWindow: WindowState;
  inventoryWindow: WindowState;
  tradeWindow: WindowState;
  setHelpWindow: (val: WindowState) => void;
  setInventoryWindow: (val: WindowState) => void;
  chatWindow: WindowState;
  setChatWindow: (val: WindowState) => void;
  statsWindow: WindowState;
  setStatsWindow: (val: WindowState) => void;
  leaderboardWindow: WindowState;
  setLeaderboardWindow: (val: WindowState) => void;
  toggleLeaderboardWindow: () => void;
  showTractorCircle?: boolean;
  setShowTractorCircle: (val?: boolean) => void;
  dialogueWindow: WindowState;
  setDialogueWindow: (val: WindowState) => void;
  promptWindow: WindowState;
  mapWindow: WindowState;
  promptWindowParams: [string, (val: string) => void, () => void];
  setPromptWindow: (val: WindowState) => void;
  setMapWindow: (val: WindowState) => void;
  setPromptWindowParams: (
    prompt: string,
    resolve: (val: string) => void,
    reject: () => void
  ) => void;
  testMenuMode: TestMenuMode;
  setTestMenuMode: (val: TestMenuMode) => void;
  activeInteractorId?: string;
  setActiveInteractorId: (id?: string) => void;
  activeHostileInteractorId?: string;
  setActiveHostileInteractorId: (id?: string) => void;
  autoFocusSpecifier?: ObjectSpecifier | null;
  setAutoFocusSpecifier: (sp?: ObjectSpecifier | null) => void;
  hostileAutoFocusSpecifier?: ObjectSpecifier | null;
  setHostileAutoFocusSpecifier: (sp?: ObjectSpecifier | null) => void;
  setHotkeyPressed: (key: string, value: boolean) => void;
  setHotkeyScope: (key: string) => void;
  tryHideAllWindows: () => void;
};

export enum TestMenuMode {
  Hidden,
  Shown,
  PlanetTest,
}

let portraitIndex = randBetweenExclusiveEnd(0, portraits.length);
const lsPortrait = extractLSValue('portrait', portraitPath(portraitIndex));
const lsPreferredName = extractLSValue('preferredName', genRandomName());
const lsSkipMenu = extractLSValue('skipMenu', false);
const lsMusicEnabled = extractLSValue('musicEnabled', false);
const lsMusicVolume = extractLSValue('musicVolume', 30);

const toggleWindowState = (old: WindowState, hasMinimized = false) => {
  if (hasMinimized) {
    if (old === WindowState.Shown) {
      return WindowState.Minimized;
    }
    if (old === WindowState.Minimized) {
      return WindowState.Hidden;
    }
    if (old === WindowState.ShownUnclosable) {
      return WindowState.MinimizedUnclosable;
    }
    if (old === WindowState.MinimizedUnclosable) {
      return WindowState.ShownUnclosable;
    }

    return WindowState.Shown;
  }

  if (old === WindowState.Shown) {
    return WindowState.Hidden;
  }
  if (old === WindowState.Hidden) {
    return WindowState.Shown;
  }
  if (old === WindowState.ShownUnclosable) {
    return WindowState.ShownUnclosable;
  }
  return WindowState.Shown;
};

import { devtools } from 'zustand/middleware';

export const useStore = create<SrnState>(
  devtools((set) => ({
    mainUiState: MainUiState.Idle,
    testMenuMode: TestMenuMode.Hidden,
    menu: true,
    skipMenu: lsSkipMenu,
    preferredName: lsPreferredName,
    musicEnabled: lsMusicEnabled,
    portrait: lsPortrait,
    trigger: 0,
    volume: lsMusicVolume,
    questWindow: WindowState.Hidden,
    promptWindow: WindowState.Hidden,
    chatWindow: WindowState.Minimized,
    dialogueWindow: WindowState.Hidden,
    inventoryWindow: WindowState.Hidden,
    tradeWindow: WindowState.Hidden,
    helpWindow: WindowState.Hidden,
    mapWindow: WindowState.Hidden,
    leaderboardWindow: WindowState.Hidden,
    statsWindow: WindowState.Hidden,
    showTractorCircle: undefined,
    selectedObjectId: undefined,
    contextMenuItems: [],
    contextMenuRef: { current: null },
    autoFocusSpecifier: undefined,
    hostileAutoFocusSpecifier: undefined,
    hotkeysPressed: {},
    hotkeyScope: 'game',

    promptWindowParams: ['', () => {}, () => {}],
    setTestMenuMode: (val: TestMenuMode) => set({ testMenuMode: val }),
    setMapWindow: (val: WindowState) => set({ mapWindow: val }),
    setShowTractorCircle: (val) => set({ showTractorCircle: val }),
    setPreferredName: (val: string) =>
      set(() => {
        setLSValue('preferredName', val);
        return { preferredName: val };
      }),
    setVolume: (val: number) =>
      set(() => {
        setLSValue('musicVolume', val);
        return { volume: val };
      }),
    setQuestWindow: (val: WindowState) => set({ questWindow: val }),
    setHelpWindow: (val: WindowState) => set({ helpWindow: val }),
    setChatWindow: (val: WindowState) => set({ chatWindow: val }),
    setStatsWindow: (val: WindowState) => set({ statsWindow: val }),
    setInventoryWindow: (val: WindowState) => set({ inventoryWindow: val }),
    setPromptWindow: (val: WindowState) => set({ promptWindow: val }),
    setPromptWindowParams: (
      prompt: string,
      resolve: (val: string) => void,
      reject: () => void
    ) => set({ promptWindowParams: [prompt, resolve, reject] }),
    setTradeWindow: (val: WindowState) => set({ tradeWindow: val }),
    setLeaderboardWindow: (val: WindowState) => set({ leaderboardWindow: val }),
    setDialogueWindow: (val: WindowState) => set({ dialogueWindow: val }),
    toggleQuestWindow: () =>
      set((state) => {
        return { questWindow: toggleWindowState(state.questWindow, true) };
      }),
    toggleHelpWindow: () =>
      set((state) => {
        return { helpWindow: toggleWindowState(state.helpWindow) };
      }),
    toggleInventoryWindow: () =>
      set((state) => {
        return { inventoryWindow: toggleWindowState(state.inventoryWindow) };
      }),
    toggleStatsWindow: () =>
      set((state) => {
        return { statsWindow: toggleWindowState(state.statsWindow) };
      }),
    toggleTradeWindow: () =>
      set((state) => {
        return { inventoryWindow: toggleWindowState(state.tradeWindow) };
      }),
    toggleMapWindow: () =>
      set((state) => {
        return { mapWindow: toggleWindowState(state.mapWindow) };
      }),
    toggleChatWindow: () =>
      set((state) => {
        return { chatWindow: toggleWindowState(state.chatWindow, true) };
      }),
    toggleLeaderboardWindow: () =>
      set((state) => {
        return {
          leaderboardWindow: toggleWindowState(state.leaderboardWindow, true),
        };
      }),
    setMenu: (val: boolean) => set({ menu: val }),
    toggleMenu: () => set((state) => ({ menu: !state.menu })),
    setSkipMenu: (val: boolean) =>
      set(() => {
        setLSValue('skipMenu', val);
        return { skipMenu: val };
      }),
    setMusicEnabled: (val: boolean) =>
      set(() => {
        setLSValue('musicEnabled', val);
        return { musicEnabled: val };
      }),
    setPortrait: (val: string) => set({ portrait: val }),
    forceUpdate: () => set((state) => ({ trigger: state.trigger + 1 })),
    setMainUiState: (val: MainUiState) => set({ mainUiState: val }),

    nextPortrait: () =>
      set((state) => {
        const locIndex = (portraitIndex + 1) % portraits.length;
        const locPort = portraitPath(locIndex);
        state.setPortrait(locPort);
        setLSValue('portrait', locPort);
        portraitIndex = locIndex;
        return {};
      }),

    prevPortrait: () =>
      set((state) => {
        let number = portraitIndex - 1;
        if (number < 0) number = portraits.length + number;
        const locIndex = number % portraits.length;
        const locPort = portraitPath(locIndex);
        setLSValue('portrait', locPort);
        state.setPortrait(locPort);
        portraitIndex = locIndex;
        return {};
      }),

    makeRandomName: () =>
      set(() => {
        deleteLSValue('preferredName');
        return {
          preferredName: genRandomName(),
        };
      }),
    makeRandomPortrait: () =>
      set(() => {
        const portraitIndex = randBetweenExclusiveEnd(0, portraits.length);
        const portrait = portraitPath(portraitIndex);
        deleteLSValue('portrait');
        return { portraitIndex, portrait };
      }),
    activeInteractorId: undefined,
    activeHostileInteractorId: undefined,
    setActiveInteractorId: (id: string | undefined) =>
      set(() => ({ activeInteractorId: id })),
    setActiveHostileInteractorId: (id: string | undefined) =>
      set(() => ({ activeHostileInteractorId: id })),
    setAutoFocusSpecifier: (sp) => set(() => ({ autoFocusSpecifier: sp })),
    setHostileAutoFocusSpecifier: (sp) =>
      set(() => ({ hostileAutoFocusSpecifier: sp })),
    setHotkeyPressed: (key, value) =>
      set(() => ({ hotkeysPressed: { [key]: value } })),
    setHotkeyScope: (key) => set(() => ({ hotkeyScope: key })),
    tryHideAllWindows: () =>
      set((state) => {
        const targetWindows = Object.entries(state).filter(([key, value]) => {
          return (
            // deliberately ignore unclosable shown and minimized
            value === WindowState.Shown &&
            key.toLowerCase().indexOf('window') > -1
          );
        });
        // modify state directly instead of returning
        for (const [key] of targetWindows) {
          const setterKey = `set${_.upperFirst(key)}`;
          try {
            (state as any)[setterKey](WindowState.Hidden);
          } catch (e) {
            console.warn(`hiding window ${setterKey} failed: ${e}`);
          }
        }
        return {};
      }),
  }))
);

export const store = useStore;
export const getSrnState = store.getState;

const initialState = store.getState();
export const resetStore = () => store.setState(initialState, true);

// this is a fully derived value, hence special selector/hook
export const useActiveInteractors = (): {
  neutralId?: string;
  hostileId?: string;
} => {
  const {
    activeHostileInteractorId,
    activeInteractorId,
    autoFocusSpecifier,
    hostileAutoFocusSpecifier,
  } = useStore();

  const neutralId = activeInteractorId || _.get(autoFocusSpecifier, 'id');
  const hostileId =
    activeHostileInteractorId || _.get(hostileAutoFocusSpecifier, 'id');

  return {
    neutralId,
    hostileId,
  };
};
