import {
  adjectives,
  animals,
  uniqueNamesGenerator,
} from 'unique-names-generator';
import create from 'zustand';
import { randBetweenExclusiveEnd } from './utils/rand';

export function genRandomName() {
  return uniqueNamesGenerator({
    dictionaries: [adjectives, animals],
    separator: '-',
  }).toUpperCase();
}

export const portraits = [
  '1.jpg',
  '2.jpg',
  '3.jpg',
  '4.jpg',
  '5.jpg',
  '6.jpg',
  '7.jpg',
  '8.jpg',
  '9.jpg',
];

export function portraitPath(portraitIndex: number) {
  return `resources/chars/${portraits[portraitIndex]}`;
}

export type SrnState = {
  playing: boolean;
  setPlaying: (value: boolean) => void;
  menu: boolean;
  setMenu: (value: boolean) => void;
  preferredName: string;
  setPreferredName: (value: string) => void;
  makeRandomName: () => void;
  musicEnabled: boolean;
  setMusicEnabled: (value: boolean) => void;
  portraitIndex: number;
  setPortraitIndex: (value: number) => void;
  portrait: string;
  setPortrait: (value: string) => void;
  nextPortrait: () => void;
  prevPortrait: () => void;
  trigger: number;
  forceUpdate: () => void;
  makeRandomPortrait: () => void;
};
let portraitIndex = randBetweenExclusiveEnd(0, portraits.length);
export const useStore = create<SrnState>((set) => ({
  playing: false,
  menu: true,
  preferredName: genRandomName(),
  musicEnabled: true,
  portraitIndex: portraitIndex,
  portrait: portraitPath(portraitIndex),
  trigger: 0,

  setPreferredName: (val: string) => set({ preferredName: val }),
  setMenu: (val: boolean) => set({ menu: val }),
  setMusicEnabled: (val: boolean) => set({ musicEnabled: val }),
  setPortraitIndex: (val: number) => set({ portraitIndex: val }),
  setPortrait: (val: string) => set({ portrait: val }),
  forceUpdate: () => set((state) => ({ trigger: state.trigger + 1 })),
  setPlaying: (val: boolean) => set({ playing: val }),

  nextPortrait: () =>
    set((state) => {
      let locIndex = (state.portraitIndex + 1) % portraits.length;
      let locPort = portraitPath(locIndex);
      state.setPortrait(locPort);
      state.setPortraitIndex(locIndex);
      return {};
    }),

  prevPortrait: () =>
    set((state) => {
      let number = state.portraitIndex - 1;
      if (number < 0) number = portraits.length + number;
      let locIndex = number % portraits.length;
      let locPort = portraitPath(locIndex);
      state.setPortrait(locPort);
      state.setPortraitIndex(locIndex);
      return {};
    }),

  makeRandomName: () => set({ preferredName: genRandomName() }),
  makeRandomPortrait: () =>
    set(() => {
      let portraitIndex = randBetweenExclusiveEnd(0, portraits.length);
      let portrait = portraitPath(portraitIndex);

      return { portraitIndex, portrait };
    }),
}));
