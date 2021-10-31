// must stay function due to ts quirk
import { Tree } from '@react-three/test-renderer/dist/declarations/src/types';
import { Renderer } from '@react-three/test-renderer/dist/declarations/src/types/public';
// import * as util from 'util';

export function invariant(condition: any, message?: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

export const findAll = (
  obj: Record<string, any>,
  keyToFind: string,
  valueToFind: string | RegExp,
  parent: any = null,
  currentObjKeyName = 'unknown'
): any[] => {
  return Object.entries(obj).reduce((acc: string[], [key, value]) => {
    if (key === keyToFind) {
      let matched;
      if (valueToFind instanceof RegExp) {
        matched = valueToFind.test(value);
      } else {
        matched = valueToFind === value;
      }
      if (matched) {
        return currentObjKeyName === 'props'
          ? acc.concat(parent as any)
          : acc.concat(obj as any);
      }
    }
    if (typeof value === 'object') {
      return acc.concat(findAll(value, keyToFind, valueToFind, obj, key));
    }
    return acc;
  }, []);
};
export const findOne = (
  obj: Record<string, any>,
  keyToFind: string,
  valueToFind: string | RegExp
): any => {
  const res = findAll(obj, keyToFind, valueToFind);
  return res[0];
};

export const checkTree = (
  renderer: Renderer,
  checker: (tree: Tree) => void
) => {
  const tree = renderer.toTree();
  invariant(tree);
  checker(tree);
};

export const getTreeElem = (
  renderer: Renderer,
  keyToFind: string,
  valueToFind: string | RegExp
): any => {
  const tree = renderer.toTree();
  invariant(tree);
  const elem = findOne(tree, keyToFind, valueToFind);
  invariant(elem, `No element found by ${keyToFind}=${valueToFind}`);
  return elem;
};
