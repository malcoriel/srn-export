import { InteractorActionType, ThreeInteractor } from './ThreeInteractor';
import { StoryCanvasInternals } from '../../TestUI/StoryCanvas';
import ReactThreeTestRenderer from '@react-three/test-renderer';

import React from 'react';
import { store } from '../../store';
import * as util from 'util';
import { ObjectSpecifierBuilder } from '../../../../world/pkg/world.extra';

// must stay function due to ts quirk
export function invariant(condition: any, message?: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

const findNested = (
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
      return acc.concat(findNested(value, keyToFind, valueToFind));
    }
    return acc;
  }, []);

describe('ThreeInteractor', () => {
  it('can render and change state with mock store', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <StoryCanvasInternals>
        <ThreeInteractor
          radius={5}
          objectId="1"
          perfId="1"
          interactor={{ defaultAction: InteractorActionType.Tractor }}
          testCompatibleMode
        />
      </StoryCanvasInternals>
    );
    await ReactThreeTestRenderer.act(async () => {
      store.setState({
        autoFocusSpecifier: ObjectSpecifierBuilder.ObjectSpecifierMineral({
          id: '1',
        }),
      });
    });
    const graph = renderer.toGraph();
    const tree = renderer.toTree();
    invariant(graph && tree);
    console.log(util.inspect(graph, false, 8));
    console.log({
      found: findNested(tree, 'name', /main/),
    });
  });
});
