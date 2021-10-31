import { InteractorActionType, ThreeInteractor } from './ThreeInteractor';
import { StoryCanvasInternals } from '../../TestUI/StoryCanvas';
import ReactThreeTestRenderer from '@react-three/test-renderer';

import React from 'react';
import { store } from '../../store';
import { ObjectSpecifierBuilder } from '../../../../world/pkg/world.extra';

// must stay function due to ts quirk
export function invariant(condition: any, message?: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

const findAll = (
  obj: Record<string, any>,
  keyToFind: string,
  valueToFind: string | RegExp
): any[] =>
  Object.entries(obj).reduce((acc: string[], [key, value]) => {
    if (key === keyToFind) {
      let matched = false;
      if (valueToFind instanceof RegExp) {
        matched = valueToFind.test(value);
      } else {
        matched = valueToFind === value;
      }
      if (matched) {
        return acc.concat(obj as any);
      }
    }
    if (typeof value === 'object') {
      return acc.concat(findAll(value, keyToFind, valueToFind));
    }
    return acc;
  }, []);

const findOne = (
  obj: Record<string, any>,
  keyToFind: string,
  valueToFind: string | RegExp
): any => {
  const res = findAll(obj, keyToFind, valueToFind);
  return res[0];
};

const renderInteractor = (id: string) => (
  <ThreeInteractor
    radius={5}
    objectId={id}
    perfId={id}
    interactor={{ defaultAction: InteractorActionType.Tractor }}
    testCompatibleMode
  />
);

describe('ThreeInteractor', () => {
  it('can render and change state with mock store', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <StoryCanvasInternals>{renderInteractor('1')}</StoryCanvasInternals>
    );
    await ReactThreeTestRenderer.act(async () => {
      store.setState({
        autoFocusSpecifier: ObjectSpecifierBuilder.ObjectSpecifierMineral({
          id: '1',
        }),
      });
    });
    const tree = renderer.toTree();
    invariant(tree);
    const hint = findOne(tree, 'name', /text-action-hint/);
    expect(hint).not.toBeFalsy();
  });

  it('can render 2 neutral interactors, but only one will be lit', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <StoryCanvasInternals>
        {renderInteractor('1')}
        {renderInteractor('2')}
      </StoryCanvasInternals>
    );
    await ReactThreeTestRenderer.act(async () => {
      store.setState({
        autoFocusSpecifier: ObjectSpecifierBuilder.ObjectSpecifierMineral({
          id: '1',
        }),
      });
    });
    const tree = renderer.toTree();
    invariant(tree);
    const hints = findAll(tree, 'name', /text-action-hint/);
    expect(hints.length).toEqual(1);
  });
});
