import React, { ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '../../store';
import { Color } from 'three';
import { MouseEvent } from 'react-three-fiber/canvas';
import { Html } from '@react-three/drei';
import '@szhsin/react-menu/dist/index.css';
import { HintWindow } from '../../HtmlLayers/HintWindow';
import NetState from '../../NetState';
import { useHotkeys } from 'react-hotkeys-hook';
import './ThreeInteractor.scss';
import { Text, Center } from '@react-three/drei';
import { vecToThreePos } from '../ThreeLayer';
import { VectorF } from '../../utils/Vector';
import { teal } from '../../utils/palette';
import {
  UpdateStrategy,
  UpdateStrategyBuilder,
} from '../../utils/UpdateStrategy';

export enum InteractorActionType {
  Unknown,
  Dock,
  Undock,
  Tractor,
  Shoot,
}

const mapActionToText = (t: InteractorActionType) => {
  return InteractorActionType[t];
};

export type InteractorActionFn = (objectId: string) => void;

export interface ThreeInteractorProps {
  actions?: Map<InteractorActionType, InteractorActionFn>;
  hint?: ReactNode;
  outlineThickness?: number;
  outlineColor?: string;
  defaultAction?: InteractorActionType;
}

const DEFAULT_OUTLINE_THICKNESS = 0.1;
const DEFAULT_OUTLINE_COLOR = 'red';

const KbAction: React.FC<{
  action?: InteractorActionFn;
  hotkey: string;
  objectId: string;
}> = ({ objectId, action, hotkey }) => {
  useHotkeys(hotkey, () => {
    if (!action) {
      return;
    }
    action(objectId);
  });
  return null;
};

const ThreeInteractorImpl = ({
  objectId,
  radius,
  interactor: {
    outlineThickness = DEFAULT_OUTLINE_THICKNESS,
    outlineColor = DEFAULT_OUTLINE_COLOR,
    actions,
    hint,
    defaultAction,
  },
}: {
  perfId?: string;
  objectId: string;
  radius: number;
  interactor: ThreeInteractorProps;
}) => {
  const [active, setActive] = useState(false);
  const [menuShown, setMenuShown] = useState(false);
  const onPointerOver = () => {
    setActive(true);
  };
  const onPointerOut = () => {
    setActive(false);
  };

  const setActiveInteractorId = useStore(
    (state) => state.setActiveInteractorId
  );
  const activeInteractorId = useStore((state) => state.activeInteractorId);

  const isAutoFocused = (() => {
    const ns = NetState.get();
    if (!ns) {
      return false;
    }
    const autoFocus = ns.indexes.myShip?.auto_focus;
    if (!autoFocus || autoFocus.tag === 'Unknown' || autoFocus.tag === 'Star')
      return false;
    return autoFocus?.id === objectId;
  })();

  useEffect(() => {
    if (active && !isAutoFocused) {
      setActiveInteractorId(objectId);
    } else if (activeInteractorId === objectId) {
      setActiveInteractorId(undefined);
    }
  }, [
    active,
    setActiveInteractorId,
    objectId,
    activeInteractorId,
    isAutoFocused,
  ]);

  const tempAutoFocusActive = !activeInteractorId && isAutoFocused;

  const onLeftClick = (e?: MouseEvent) => {
    if (e) {
      e.stopPropagation();
      e.sourceEvent.preventDefault();
      e.sourceEvent.stopPropagation();
    }
    if (actions && defaultAction) {
      const fn = actions.get(defaultAction);
      if (fn) {
        fn(objectId);
      }
    }
    return false;
  };
  const onContextMenu = (e: MouseEvent) => {
    e.sourceEvent.preventDefault();
    setMenuShown(!menuShown);
    return false;
  };

  const visuallyActive = tempAutoFocusActive || active;

  const memoizedColor = useMemo(() => new Color(outlineColor), [outlineColor]);
  const outlineVisible = visuallyActive ? 1.0 : 0.0;
  const menuAnchorRef = useRef(null);
  const setContextMenuRef = useStore((state) => state.setContextMenuRef);
  const setContextMenuItems = useStore((state) => state.setContextMenuItems);
  const setShowTractorCircle = useStore((state) => state.setShowTractorCircle);
  useEffect(() => {
    if (defaultAction === InteractorActionType.Tractor) {
      setShowTractorCircle(visuallyActive);
    }
  }, [defaultAction, visuallyActive, setShowTractorCircle]);
  useEffect(() => {
    if (menuShown && menuAnchorRef.current) {
      setContextMenuRef(menuAnchorRef);
      const items = [...(actions?.entries() || [])].map(([key, fn]) => ({
        text: InteractorActionType[key],
        onClick: () => {
          fn(objectId);
          setMenuShown(false);
        },
        id: key.toString(),
      }));
      setContextMenuItems(items);
    } else {
      setContextMenuItems([]);
      setTimeout(() => {
        setContextMenuRef({ current: null });
      }, 0);
    }
  }, [
    objectId,
    menuAnchorRef,
    menuShown,
    setContextMenuItems,
    setContextMenuRef,
    actions,
  ]);

  // noinspection RequiredAttributes
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
      {visuallyActive && defaultAction && (
        <>
          <KbAction
            action={actions && actions.get(defaultAction)}
            objectId={objectId}
            hotkey="e"
          />
          <Text
            visible
            position={vecToThreePos(VectorF(0, -(radius + 6)))}
            color={teal}
            fontSize={1.5}
            maxWidth={20}
            lineHeight={1}
            letterSpacing={0.02}
            textAlign="left"
            anchorX="center"
            anchorY="bottom"
          >
            Press E to {mapActionToText(defaultAction)}
          </Text>
        </>
      )}
      <Html>
        <div ref={menuAnchorRef} />
        {visuallyActive && hint && <HintWindow windowContent={hint} />}
      </Html>
      <mesh>
        <ringGeometry
          args={[
            radius - outlineThickness,
            radius + outlineThickness,
            Math.max(16, radius * 3),
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

export const ThreeInteractor = UpdateStrategy(
  ThreeInteractorImpl,
  'ThreeInteractor',
  UpdateStrategyBuilder.NoInvisibleUpdate()
);
