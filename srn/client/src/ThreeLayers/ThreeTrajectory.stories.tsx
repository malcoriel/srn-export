import React, { useEffect, useMemo, useState } from 'react';
import { Meta, Story } from '@storybook/react';
import * as uuid from 'uuid';
import { StoryCanvas } from '../TestUI/StoryCanvas';
import { ThreeSpaceBackground } from './ThreeSpaceBackground';
import Vector, {
  getCounterClockwiseAngleMath,
  IVector,
  VectorF,
} from '../utils/Vector';
import { posToThreePos } from './util';
import Color from 'color';
import _ from 'lodash';

export interface ThreeTrajectoryItemProps {
  position: IVector;
  velocityNormalized: Vector; // len 0.0 - no speed, 1.0 - maximal speed, direction = speed direciton
  accNormalized: Vector; // len 0.0 - no acc, 1.0 - maximal acceleration
  mainColor: string;
  accColor: string;
}

const lerp = (a: number, b: number, v: number) => a + (b - a) * v;

const ThreeTrajectoryItem: React.FC<ThreeTrajectoryItemProps> = ({
  position,
  mainColor,
  accColor,
  velocityNormalized,
  accNormalized,
}) => {
  const showAcc = Math.abs(accNormalized.length()) > 1e-6;
  const showVel = Math.abs(velocityNormalized.length()) > 1e-6;
  const [angleVel, angleAcc] = useMemo(() => {
    const vel = showVel
      ? getCounterClockwiseAngleMath(VectorF(1, 0), velocityNormalized)
      : 0;
    const acc = showAcc
      ? getCounterClockwiseAngleMath(VectorF(1, 0), accNormalized)
      : 0;
    return [vel - Math.PI / 2, acc - Math.PI / 2];
  }, [accNormalized, velocityNormalized]);
  const [minColorL, maxColorL, baseColor] = useMemo(() => {
    const base = new Color(mainColor);
    return [base.darken(0.5).lightness(), base.lighten(0.5).lightness(), base];
  }, [mainColor]);
  const color = useMemo(() => {
    let len = Vector.fromIVector(velocityNormalized).length();
    len = Math.max(0.0, Math.min(1.0, len));
    const lerped = lerp(minColorL, maxColorL, len);
    return _.cloneDeep(baseColor).lightness(lerped);
  }, [minColorL, maxColorL, baseColor, velocityNormalized]);
  return (
    <group position={posToThreePos(position.x, position.y)}>
      <mesh rotation={[0, 0, angleVel]}>
        <mesh>
          <circleBufferGeometry args={[3, 16]} />
          <meshBasicMaterial
            opacity={1.0}
            transparent
            color={color.hex().toString()}
          />
        </mesh>
        {showVel && (
          <mesh
            rotation={[Math.PI * (1.66 + 0.66), Math.PI, Math.PI * 1.25]}
            position={[0, 2.7, -2]}
            scale={[1.5, 1.5, 1.0]}
          >
            <tetrahedronGeometry args={[2, 0]} />
            <meshBasicMaterial opacity={1.0} color={color.hex().toString()} />
          </mesh>
        )}
      </mesh>
      {showAcc && (
        <mesh rotation={[0, 0, angleAcc]}>
          <mesh
            rotation={[Math.PI * (1.66 + 0.66), Math.PI, Math.PI * 1.25]}
            position={[0, 3.0, -1]}
            scale={[0.75, 0.75, 0.5]}
          >
            <tetrahedronGeometry args={[2, 0]} />
            <meshBasicMaterial opacity={1.0} color={accColor} />
          </mesh>
        </mesh>
      )}
    </group>
  );
};

const Template: Story = (args) => {
  const [revision, setRevision] = useState(uuid.v4());
  useEffect(() => {
    setRevision((old) => old + 1);
  }, []);
  return (
    <div>
      <StoryCanvas zoom={16.0}>
        <ThreeSpaceBackground size={256} shaderShift={0} />
        <ThreeTrajectoryItem
          key={`${revision}+${JSON.stringify(args)}`}
          position={VectorF(0, 0)}
          velocityNormalized={VectorF(args.velX, args.velY)}
          accNormalized={VectorF(args.accX, args.accY)}
          mainColor="red"
          accColor="green"
        />
      </StoryCanvas>
    </div>
  );
};

export const SingleItem = Template.bind({});
SingleItem.args = {
  velX: 0.7,
  velY: 1,
  accX: 0,
  accY: 1,
};

// noinspection JSUnusedGlobalSymbols
const oneToOne = {
  control: {
    type: 'range',
    min: -1.0,
    max: 1.0,
    step: 0.1,
  },
};
export default {
  title: 'Three/Trajectory',
  component: ThreeTrajectoryItem,
  argTypes: {
    velX: oneToOne,
    velY: oneToOne,
    accX: oneToOne,
    accY: oneToOne,
  },
} as Meta;
