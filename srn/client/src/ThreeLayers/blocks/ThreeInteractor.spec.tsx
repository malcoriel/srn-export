import { InteractorActionType, ThreeInteractor } from './ThreeInteractor';
import { StoryCanvasInternals } from '../../TestUI/StoryCanvas';
import ReactThreeTestRenderer from '@react-three/test-renderer';

import React from 'react';
import { store } from '../../store';
import * as util from 'util';
import { ObjectSpecifierBuilder } from '../../../../world/pkg/world.extra';

describe('ThreeInteractor', () => {
  it('can render with mock store', async () => {
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
    console.log(util.inspect(renderer.toGraph(), false, 8));
  });
});
