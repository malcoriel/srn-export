import React from 'react';
import { useFadingMaterial } from './UseFadingMaterial';
import { useStore } from '../store';
import { vecToThreePos } from './util';
import { ThreeExhaust } from './ThreeExhaust';
import { IVector, VectorF, VectorFZero } from '../utils/Vector';
import { MovementMarkers } from './MovementMarkers';

export interface ThreeRocketProps {
  position: IVector;
  velocity: IVector;
  rotation: number;
  radius: number;
  fadeOver?: number;
  markers?: string | null;
  brake: boolean;
  gas: boolean;
}

const EPS = 1e-6;
export const ThreeRocket: React.FC<ThreeRocketProps> = ({
  position,
  rotation,
  radius,
  velocity,
  fadeOver,
  markers,
  gas,
  brake,
}) => {
  const materialRef1 = useFadingMaterial(fadeOver, 1.0);

  const showGrid = useStore((srnState) => srnState.hotkeysPressed['show grid']);

  return (
    <group position={vecToThreePos(position, 0)}>
      <group
        rotation={[0, 0, rotation + Math.PI / 2]}
        scale={[radius, radius, radius]}
      >
        <mesh>
          <planeBufferGeometry args={[0.5, 1.5]} />
          <meshBasicMaterial color="red" transparent ref={materialRef1} />
        </mesh>
        <ThreeExhaust
          color="#ff0"
          speedUp={gas || brake}
          inverse={brake}
          position={VectorF(0, 0.75 * radius)}
          radius={radius * 3.0}
          rotation={-Math.PI / 2.0}
          fadeOver={fadeOver}
        />
      </group>
      {markers && showGrid && (
        <MovementMarkers
          markers={markers}
          position={VectorFZero}
          velocity={velocity}
          radius={radius}
        />
      )}
    </group>
  );
};
