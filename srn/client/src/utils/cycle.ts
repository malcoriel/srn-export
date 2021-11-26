export const cycle = (val: number, min: number, max: number) => {
  if (val > max) {
    return min;
  }
  return val;
};
