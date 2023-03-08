import React, { useEffect, useState } from 'react';
import { Meta, Story } from '@storybook/react';
import * as uuid from 'uuid';
import { StoryCanvas } from '../TestUI/StoryCanvas';
import { ThreeSpaceBackground } from './ThreeSpaceBackground';
import { IVector, VectorF } from '../utils/Vector';
import { posToThreePos } from './util';

export interface ThreeTrajectoryItemProps {
  position: IVector;
  speedNormalized: IVector; // 0.0 - no speed, 1.0 - maximal speed, direction = speed direciton
}

const ThreeTrajectoryItem: React.FC<ThreeTrajectoryItemProps> = ({
  position,
}) => {
  return (
    <group position={posToThreePos(position.x, position.y)}>
      <mesh>
        <circleBufferGeometry args={[3, 16]} />
        <meshBasicMaterial opacity={1.0} transparent color="red" />
      </mesh>
      <mesh
        rotation={[Math.PI * (1.66 + 0.66), Math.PI, Math.PI * 1.25]}
        position={[0, 2.7, -1]}
        scale={[1.5, 1.5, 1.0]}
      >
        <tetrahedronGeometry args={[2, 0]} />
        <meshBasicMaterial opacity={1.0} color="yellow" />
      </mesh>
    </group>
  );
};

const Template: Story = (args) => {
  const [revision, setRevision] = useState(uuid.v4());
  useEffect(() => {
    setRevision((old) => old + 1);
  }, []);
  return (
    <div key={`${revision}+${JSON.stringify(args)}`}>
      <StoryCanvas zoom={16.0}>
        <ThreeSpaceBackground size={256} shaderShift={0} />
        <ThreeTrajectoryItem position={VectorF(0, 0)} />
      </StoryCanvas>
    </div>
  );
};

export const SingleItem = Template.bind({});
SingleItem.args = {
  tickInterval: 50,
};
// noinspection JSUnusedGlobalSymbols
export default {
  title: 'Three/Trajectory',
  argTypes: {},
} as Meta;
