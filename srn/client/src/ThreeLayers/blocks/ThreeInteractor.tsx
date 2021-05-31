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

interface ThreeInteractorOutlineProps {
  onHover: ((objectId: string) => void) | undefined;
  objectId: string;
  onBlur: ((objectId: string) => void) | undefined;
  radius: number;
  // eslint-disable-next-line react/require-default-props
  outlineThickness?: number;
  // eslint-disable-next-line react/require-default-props
  outlineColor?: string;
  // eslint-disable-next-line react/require-default-props
  actions?: Map<InteractorActionType, InteractorActionFn>;
  // eslint-disable-next-line react/require-default-props
  isSelected?: boolean;
  // eslint-disable-next-line react/require-default-props
  onReportSelected?: InteractorSelectFn;
}

export const ThreeInteractorOutline = ({
  onHover,
  objectId,
  onBlur,
  radius,
  outlineThickness = DEFAULT_OUTLINE_THICKNESS,
  outlineColor = DEFAULT_OUTLINE_COLOR,
  actions,
  onReportSelected,
  isSelected,
}: ThreeInteractorOutlineProps) => {
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
