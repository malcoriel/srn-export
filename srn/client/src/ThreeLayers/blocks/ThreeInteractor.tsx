import React, { ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '../../store';
import { Color } from 'three';
import { MouseEvent } from 'react-three-fiber/canvas';
import { Html } from '@react-three/drei';
import { ControlledMenu, MenuItem, MenuButton } from '@szhsin/react-menu';
import '@szhsin/react-menu/dist/index.css';
import { useFrame } from 'react-three-fiber';

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

export const ThreeInteractor = ({
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
  const [menuShown, setMenuShown] = useState(false);
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
  const onContextMenu = (e: MouseEvent) => {
    e.sourceEvent.preventDefault();
    if (!isSelected) {
      onLeftClick();
    }
    setMenuShown(!menuShown);
    return false;
  };
  useEffect(() => {
    if (!isSelected) {
      setMenuShown(false);
    }
  }, [isSelected, setMenuShown]);

  // useFrame(() => {
  //   if (menuShown && !isSelected) {
  //     setMenuShown(false);
  //   }
  // });

  const memoizedColor = useMemo(() => new Color(outlineColor), [outlineColor]);
  const outlineVisible = active || isSelected ? 1.0 : 0.0;
  const menuAnchorRef = useRef(null);
  return (
    <group
      onClick={onLeftClick}
      position={[0, 0, radius]}
      onContextMenu={onContextMenu}
    >
      <mesh onPointerOver={onPointerOver} onPointerOut={onPointerOut}>
        <circleBufferGeometry args={[radius, 16]} />
        <meshBasicMaterial opacity={0.0} transparent />
      </mesh>
      <Html>
        <div ref={menuAnchorRef} />
        <div>
          <ControlledMenu anchorRef={menuAnchorRef} isOpen={menuShown}>
            <MenuItem>123</MenuItem>
            <MenuItem>456</MenuItem>
          </ControlledMenu>
        </div>
      </Html>
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
