import { InteractorActionType, ThreeInteractor } from './ThreeInteractor';
import { StoryCanvasInternals } from '../../TestUI/StoryCanvas';
import ReactThreeTestRenderer from '@react-three/test-renderer';

import React from 'react';
import { store } from '../../store';
import { ObjectSpecifierBuilder } from '../../../../world/pkg/world.extra';
import { checkTree, findAll, findOne } from './testHelpers';

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
    checkTree(renderer, (tree) => {
      const hint = findOne(tree, 'name', /text-action-hint/);
      expect(hint).not.toBeFalsy();
    });
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
    checkTree(renderer, (tree) => {
      const hints = findAll(tree, 'name', /text-action-hint/);
      expect(hints.length).toEqual(1);
    });
  });
});
