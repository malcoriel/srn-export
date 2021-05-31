import React, { ReactNode, useState } from 'react';
import { useStore } from '../../store';

interface ThreeInteractorOutlineParams {
  onHover: ((objectId: string) => void) | undefined;
  objectId: string;
  onBlur: ((objectId: string) => void) | undefined;
  radius: number;
}

export enum InteractorActionType {
  Unknown,
  Select,
  Dock,
  Undock,
  Tractor,
  Shoot,
}

export type InteractorActionFn = (objectId: string) => void;

export interface ThreeInteractorProps {
  actions?: Map<InteractorActionType, InteractorActionFn>;
  hint?: ReactNode;
  onHover?: InteractorActionFn;
  onBlur?: InteractorActionFn;
}

const HOVER_THICKNESS = 0.5;

export const ThreeInteractorOutline = ({
  onHover,
  objectId,
  onBlur,
  radius,
}: ThreeInteractorOutlineParams) => {
  const setHintedObjectId = useStore((state) => state.setHintedObjectId);

  const onPointerOverExternal = onHover
    ? () => onHover(objectId)
    : () => setHintedObjectId(objectId);
  const onPointerOutExternal = onBlur
    ? () => onBlur(objectId)
    : () => setHintedObjectId(undefined);
  const [active, setActive] = useState(false);
  const onPointerOver = () => {
    setActive(true);
    onPointerOverExternal();
  };
  const onPointerOut = () => {
    setActive(false);
    onPointerOutExternal();
  };

  return (
    <group>
      <mesh onPointerOver={onPointerOver} onPointerOut={onPointerOut}>
        <circleBufferGeometry args={[radius, 16]} />
        <meshBasicMaterial opacity={0.0} transparent />
      </mesh>
      <mesh>
        <ringGeometry
          args={[
            radius - HOVER_THICKNESS,
            radius + HOVER_THICKNESS,
            radius * 2,
          ]}
        />
        <meshBasicMaterial
          opacity={active ? 1.0 : 0.0}
          transparent
          color="red"
        />
      </mesh>
    </group>
  );
};
