import React, { ReactNode, useMemo, useState } from 'react';
import { useStore } from '../../store';
import { Color } from 'three';

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
  onReportSelected?: InteractorSelectFn;
  isSelected?: boolean;
  outlineThickness?: number;
  outlineColor?: string;
}

const DEFAULT_OUTLINE_THICKNESS = 0.5;
const DEFAULT_OUTLINE_COLOR = 'red';

type InteractorSelectFn = (objectId: string, val: boolean) => void;

export const ThreeInteractorOutline = ({
  objectId,
  radius,
  interactor: {
    onHover,
    onBlur,
    outlineThickness = DEFAULT_OUTLINE_THICKNESS,
    outlineColor = DEFAULT_OUTLINE_COLOR,
    actions,
    onReportSelected,
    isSelected,
  },
}: {
  objectId: string;
  radius: number;
  interactor: ThreeInteractorProps;
}) => {
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

  const selectOnLeftClick = actions && actions.get(InteractorActionType.Select);
  const onLeftClick = () => {
    if (onReportSelected && selectOnLeftClick) {
      onReportSelected(objectId, !isSelected);
    }
    setActive(!isSelected);
  };

  const memoizedColor = useMemo(() => new Color(outlineColor), [outlineColor]);
  const outlineVisible = active || isSelected ? 1.0 : 0.0;
  return (
    <group onClick={onLeftClick} position={[0, 0, radius]}>
      <mesh onPointerOver={onPointerOver} onPointerOut={onPointerOut}>
        <circleBufferGeometry args={[radius, 16]} />
        <meshBasicMaterial opacity={0.0} transparent />
      </mesh>
      <mesh>
        <ringGeometry
          args={[
            radius - outlineThickness,
            radius + outlineThickness,
            radius * 2,
          ]}
        />
        <meshBasicMaterial
          opacity={outlineVisible}
          transparent
          color={memoizedColor}
        />
      </mesh>
    </group>
  );
};
