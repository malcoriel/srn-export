export const randBetweenExclusiveEnd = (min: number, max: number) => {
  const dif = Math.floor(Math.random() * (max - min));
  return min + dif;
};
