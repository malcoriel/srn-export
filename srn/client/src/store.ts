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
import React from 'react';
import { GlobalContextMenuItem } from './HtmlLayers/GlobalContextMenu';

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
  toggleMapWindow: () => void;
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
  showTractorCircle?: boolean;
  setShowTractorCircle: (val?: boolean) => void;
  selectedObjectId?: string;
  setSelectedObjectId: (id?: string) => void;
  onReportSelected: (id: string, value: boolean) => void;
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
  contextMenuRef: React.RefObject<any>;
  setContextMenuRef: (ref: React.RefObject<any>) => void;
  contextMenuItems: GlobalContextMenuItem[];
  setContextMenuItems: (items: GlobalContextMenuItem[]) => void;
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
  promptWindowParams: ['', () => {}, () => {}],
  chatWindow: WindowState.Minimized,
  dialogueWindow: WindowState.Hidden,
  inventoryWindow: WindowState.Hidden,
  tradeWindow: WindowState.Hidden,
  helpWindow: WindowState.Hidden,
  mapWindow: WindowState.Hidden,
  leaderboardWindow: WindowState.Minimized,
  showTractorCircle: undefined,
  selectedObjectId: undefined,
  contextMenuItems: [],
  contextMenuRef: { current: null },

  setTestMenuMode: (val: TestMenuMode) => set({ testMenuMode: val }),
  setMapWindow: (val: WindowState) => set({ mapWindow: val }),
  setShowTractorCircle: (val) => set({ showTractorCircle: val }),
  setSelectedObjectId: (val) => set({ selectedObjectId: val }),
  onReportSelected: (id: string, val: boolean) =>
    set(() => ({ selectedObjectId: val ? id : undefined })),

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
  setPlaying: (val: boolean) => set({ playing: val }),
  setContextMenuRef: (ref: React.RefObject<any>) =>
    set({ contextMenuRef: ref }),
  setContextMenuItems: (items: GlobalContextMenuItem[]) =>
    set({ contextMenuItems: items }),

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
