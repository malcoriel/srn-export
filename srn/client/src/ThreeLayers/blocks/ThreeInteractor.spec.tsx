import { InteractorActionType, ThreeInteractor } from './ThreeInteractor';
import { StoryCanvasInternals } from '../../TestUI/StoryCanvas';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { Renderer } from '@react-three/test-renderer/dist/declarations/src/types/public';

import React from 'react';
import { store } from '../../store';
import { ObjectSpecifierBuilder } from '../../../../world/pkg/world.extra';
import { checkTree, findAll, findOne, getTreeElem } from './testHelpers';
import * as util from 'util';

// @ts-ignore
global.reactAct = ReactThreeTestRenderer.act;

export const renderInteractor = (id: string) => (
  <ThreeInteractor
    radius={5}
    objectId={id}
    perfId={id}
    interactor={{ defaultAction: InteractorActionType.Tractor }}
    testCompatibleMode
  />
);

const expectInteractorVisuallySelected = (renderer: Renderer, id: string) => {
  checkTree(renderer, (tree) => {
    expect(
      findOne(tree, 'name', new RegExp(`ring-${id}-visible`))
    ).toBeTruthy();
  });
};

const expectInteractorVisuallyNotSelected = (
  renderer: Renderer,
  id: string
) => {
  checkTree(renderer, (tree) => {
    expect(findOne(tree, 'name', new RegExp(`ring-${id}-visible`))).toBeFalsy();
  });
};

describe('ThreeInteractor', () => {
  let renderer: Renderer;

  afterEach(async () => {
    if (renderer) {
      await renderer.unmount();
    }
  });

  xit('can render and change state with mock store', async () => {
    renderer = await ReactThreeTestRenderer.create(
      <StoryCanvasInternals>{renderInteractor('1')}</StoryCanvasInternals>
    );

    await ReactThreeTestRenderer.act(async () => {
      store.setState({
        autoFocusSpecifier: ObjectSpecifierBuilder.ObjectSpecifierMineral({
          id: '1',
        }),
      });
    });
    checkTree(renderer, (tree) => {
      const hint = findOne(tree, 'name', /text-action-hint/);
      expect(hint).not.toBeFalsy();
    });
  });

  describe('can render 2 neutral interactors', () => {
    it('but only one will be lit', async () => {
      renderer = await ReactThreeTestRenderer.create(
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
      checkTree(renderer, (tree) => {
        const hints = findAll(tree, 'name', /text-action-hint/);
        expect(hints.length).toEqual(1);
      });
    });

    it('selection can change with hovers', async () => {
      await ReactThreeTestRenderer.act(async () => {
        store.setState({
          autoFocusSpecifier: ObjectSpecifierBuilder.ObjectSpecifierMineral({
            id: '1',
          }),
        });
      });
      renderer = await ReactThreeTestRenderer.create(
        <StoryCanvasInternals>
          {renderInteractor('1')}
          {renderInteractor('2')}
        </StoryCanvasInternals>
      );
      const hoverDetector2 = getTreeElem(renderer, 'name', 'hover-detector-2');
      await renderer.fireEvent(hoverDetector2, 'pointerOver', {});
      expectInteractorVisuallySelected(renderer, '2');
      expectInteractorVisuallyNotSelected(renderer, '1');
      await renderer.fireEvent(hoverDetector2, 'pointerOut', {});
      expectInteractorVisuallySelected(renderer, '1');
      expectInteractorVisuallyNotSelected(renderer, '2');
    });
  });

  describe('can render neutral and hostile interactor at the same time', () => {
    it('if both are autofocused, both are lit', async () => {
      renderer = await ReactThreeTestRenderer.create(
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
          hostileAutoFocusSpecifier: ObjectSpecifierBuilder.ObjectSpecifierMineral(
            {
              id: '2',
            }
          ),
        });
      });
      expectInteractorVisuallySelected(renderer, '1');
      expectInteractorVisuallySelected(renderer, '2');
    });

    it.todo(
      'if only neutral is autofocused, selecting other will keep both lit'
    );
    it.todo(
      'if only hostile is autofocused, selecting other will keep both lit'
    );
  });
});
