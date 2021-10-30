import { ThreeInteractor } from './ThreeInteractor';
import { StoryCanvasInternals } from '../../TestUI/StoryCanvas';
import ReactThreeTestRenderer from '@react-three/test-renderer';

const render = ReactThreeTestRenderer.create;
import React from 'react';
describe('ThreeInteractor', () => {
  it('can render with mock store', async () => {
    await render(
      <StoryCanvasInternals>
        <mesh>
          <ringGeometry args={[1, 1, 1]} />
          <meshBasicMaterial opacity={0.5} transparent color="red" />
        </mesh>
        {/*<ThreeInteractor radius={5} objectId="1" perfId="1" interactor={{}} />*/}
      </StoryCanvasInternals>
    );
  });
});
