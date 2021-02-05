import Color from 'color';

type Color3Arr = [number, number, number];
export const normalize3 = (c: string): Color3Arr => {
  return new Color(c)
    .rgb()
    .array()
    .map((v) => v / 255) as Color3Arr;
};
export const babyBlue = '#7ec8e3';
export const blue = '#0000ff';
export const navyBlue = '#000c66';
export const darkBlue = '#050a30';
export const gray = '#555';
export const tiffanyBlue = '#a0e7e5';
export const mint = '#b4f8c8';
export const yellow = '#fbe7c6';
export const teal = '#06f9e6';
export const crimson = '#e32636';
export const darkGreen = '#03c03c';
export const dirtyGray = '#60593c';
export const rare = '#ffd700';
export const uncommon = '#c0c0c0';
export const common = '#b87333';
