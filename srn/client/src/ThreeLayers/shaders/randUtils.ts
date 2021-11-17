import Prando from 'prando';
import random from 'random/dist/cjs/random.js';

export const variateUniform = (min: number, max: number, prng: Prando) => {
  return prng.next(min, max + 1e-10);
};
const randomCompatiblePrng = (prng: Prando) => {
  return () => prng.next(0, 1);
};
export const variateNormal = (
  min: number,
  max: number,
  variance: number,
  prng: Prando
) => {
  const cloned = random.clone('');
  // @ts-ignore
  cloned.use(randomCompatiblePrng(prng));
  let value = cloned.normal((max - min) / 2 + min, variance)();
  value = Math.max(min, value);
  value = Math.min(max, value);
  return value;
};
