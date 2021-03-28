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
}

export type SrnState = {
  playing: boolean;
  setPlaying: (value: boolean) => void;
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
  toggleTradeWindow: () => void;
  helpWindow: WindowState;
  inventoryWindow: WindowState;
  tradeWindow: WindowState;
  setHelpWindow: (val: WindowState) => void;
  setInventoryWindow: (val: WindowState) => void;
  chatWindow: WindowState;
  setChatWindow: (val: WindowState) => void;
  leaderboardWindow: WindowState;
  setLeaderboardWindow: (val: WindowState) => void;
  toggleLeaderboardWindow: () => void;
  hintedObjectId?: string;
  setHintedObjectId: (val?: string) => void;
  dialogueWindow: WindowState;
  setDialogueWindow: (val: WindowState) => void;
  promptWindow: WindowState;
  promptWindowParams: [string, (val: string) => void, () => void];
  setPromptWindow: (val: WindowState) => void;
  setPromptWindowParams: (
    prompt: string,
    resolve: (val: string) => void,
    reject: () => void
  ) => void;
  testMenuMode: TestMenuMode;
  setTestMenuMode: (val: TestMenuMode) => void;
};

export enum TestMenuMode {
  Hidden,
  Shown,
  PlanetTest,
  ShaderTest,
}

let portraitIndex = randBetweenExclusiveEnd(0, portraits.length);
const lsPortrait = extractLSValue('portrait', portraitPath(portraitIndex));
const lsPreferredName = extractLSValue('preferredName', genRandomName());
const lsSkipMenu = extractLSValue('skipMenu', false);
const lsMusicEnabled = extractLSValue('musicEnabled', false);
const lsMusicVolume = extractLSValue('musicVolume', 30);

function toggleWindowState(old: WindowState, hasMinimized = false) {
  if (hasMinimized) {
    if (old === WindowState.Shown) {
      return WindowState.Minimized;
    }
    if (old === WindowState.Minimized) {
      return WindowState.Hidden;
    }
    return WindowState.Shown;
  }

  if (old === WindowState.Shown) {
    return WindowState.Hidden;
  }
  return WindowState.Shown;
}

export const useStore = create<SrnState>((set) => ({
  playing: false,
  testMenuMode: TestMenuMode.ShaderTest,
  menu: true,
  skipMenu: lsSkipMenu,
  preferredName: lsPreferredName,
  musicEnabled: lsMusicEnabled,
  portrait: lsPortrait,
  trigger: 0,
  volume: lsMusicVolume,
  questWindow: WindowState.Minimized,
  promptWindow: WindowState.Hidden,
  promptWindowParams: ['', () => {}, () => {}],
  chatWindow: WindowState.Minimized,
  dialogueWindow: WindowState.Hidden,
  inventoryWindow: WindowState.Hidden,
  tradeWindow: WindowState.Hidden,
  helpWindow: WindowState.Hidden,
  leaderboardWindow: WindowState.Minimized,
  hintedObjectId: undefined,

  setTestMenuMode: (val: TestMenuMode) => set({ testMenuMode: val }),
  setHintedObjectId: (val?: string) => set({ hintedObjectId: val }),

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
  toggleTradeWindow: () =>
    set((state) => {
      return { inventoryWindow: toggleWindowState(state.tradeWindow) };
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
  setPlaying: (val: boolean) => set({ playing: val }),

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
}));
