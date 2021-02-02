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
  toggleQuestWindow: () => void;
  toggleHelpWindow: () => void;
  toggleChatWindow: () => void;
  toggleInventoryWindow: () => void;
  helpWindow: WindowState;
  inventoryWindow: WindowState;
  setHelpWindow: (val: WindowState) => void;
  setInventoryWindow: (val: WindowState) => void;
  chatWindow: WindowState;
  setChatWindow: (val: WindowState) => void;
  leaderboardWindow: WindowState;
  setLeaderboardWindow: (val: WindowState) => void;
  toggleLeaderboardWindow: () => void;
  hintedObjectId?: string;
  setHintedObjectId: (val?: string) => void;
};

let portraitIndex = randBetweenExclusiveEnd(0, portraits.length);
let lsPortrait = extractLSValue('portrait', portraitPath(portraitIndex));
let lsPreferredName = extractLSValue('preferredName', genRandomName());
let lsSkipMenu = extractLSValue('skipMenu', false);
let lsMusicEnabled = extractLSValue('musicEnabled', false);
let lsMusicVolume = extractLSValue('musicVolume', 30);

function toggleWindowState(old: WindowState, hasMinimized: boolean = false) {
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
  menu: true,
  skipMenu: lsSkipMenu,
  preferredName: lsPreferredName,
  musicEnabled: lsMusicEnabled,
  portrait: lsPortrait,
  trigger: 0,
  volume: lsMusicVolume,
  questWindow: WindowState.Minimized,
  chatWindow: WindowState.Minimized,
  inventoryWindow: WindowState.Shown,
  helpWindow: WindowState.Hidden,
  leaderboardWindow: WindowState.Minimized,
  hintedObjectId: undefined,

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
  setLeaderboardWindow: (val: WindowState) => set({ leaderboardWindow: val }),
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
  toggleChatWindow: () =>
    set((state) => {
      return { chatWindow: toggleWindowState(state.chatWindow, true) };
    }),
  toggleLeaderboardWindow: () =>
    set((state) => {
      return { leaderboardWindow: toggleWindowState(state.leaderboardWindow, true) };
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
      let locIndex = (portraitIndex + 1) % portraits.length;
      let locPort = portraitPath(locIndex);
      state.setPortrait(locPort);
      setLSValue('portrait', locPort);
      portraitIndex = locIndex;
      return {};
    }),

  prevPortrait: () =>
    set((state) => {
      let number = portraitIndex - 1;
      if (number < 0) number = portraits.length + number;
      let locIndex = number % portraits.length;
      let locPort = portraitPath(locIndex);
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
      let portraitIndex = randBetweenExclusiveEnd(0, portraits.length);
      let portrait = portraitPath(portraitIndex);
      deleteLSValue('portrait');
      return { portraitIndex, portrait };
    }),
}));
