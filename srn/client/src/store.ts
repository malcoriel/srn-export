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

export type SrnState = {
  playing: boolean;
  setPlaying: (value: boolean) => void;
  menu: boolean;
  skipMenu: boolean;
  setSkipMenu: (value: boolean) => void;
  setMenu: (value: boolean) => void;
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
};

let portraitIndex = randBetweenExclusiveEnd(0, portraits.length);
let lsPortrait = extractLSValue('portrait', portraitPath(portraitIndex));
let lsPreferredName = extractLSValue('preferredName', genRandomName());
let lsSkipMenu = extractLSValue('skipMenu', false);
let lsMusicEnabled = extractLSValue('musicEnabled', true);
let lsMusicVolume = extractLSValue('musicVolume', 50);

export const useStore = create<SrnState>((set) => ({
  playing: false,
  menu: true,
  skipMenu: lsSkipMenu,
  preferredName: lsPreferredName,
  musicEnabled: lsMusicEnabled,
  portrait: lsPortrait,
  trigger: 0,
  volume: lsMusicVolume,

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
  setMenu: (val: boolean) => set({ menu: val }),
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
