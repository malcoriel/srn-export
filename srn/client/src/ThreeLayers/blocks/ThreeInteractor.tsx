import React, { ReactNode, useEffect, useMemo, useState } from 'react';
import { useStore } from '../../store';
import { Color } from 'three';
import { Html, Text } from '@react-three/drei';
import '@szhsin/react-menu/dist/index.css';
import { HintWindow } from '../../HtmlLayers/HintWindow';
import { useHotkeys } from 'react-hotkeys-hook';
import './ThreeInteractor.scss';
import { VectorF } from '../../utils/Vector';
import { teal } from '../../utils/palette';
import {
  UpdateStrategy,
  UpdateStrategyBuilder,
} from '../../utils/UpdateStrategy';
import { ThreeEvent } from '@react-three/fiber/dist/declarations/src/core/events';
import { vecToThreePos } from '../util';

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
  testCompatibleMode,
  interactor: {
    outlineThickness = DEFAULT_OUTLINE_THICKNESS,
    outlineColor = DEFAULT_OUTLINE_COLOR,
    actions,
    hint,
    defaultAction,
  },
}: {
  // eslint-disable-next-line react/no-unused-prop-types
  perfId: string;
  objectId: string;
  radius: number;
  testCompatibleMode: boolean;
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

  const {
    activeInteractorId,
    activeHostileInteractorId,
    autoFocusSpecifier,
    hostileAutoFocusSpecifier,
    setActiveInteractorId,
    setActiveHostileInteractorId,
  } = useStore((state) => ({
    activeInteractorId: state.activeInteractorId,
    activeHostileInteractorId: state.activeHostileInteractorId,
    autoFocusSpecifier: state.autoFocusSpecifier,
    hostileAutoFocusSpecifier: state.hostileAutoFocusSpecifier,
    setActiveInteractorId: state.setActiveInteractorId,
    setActiveHostileInteractorId: state.setActiveHostileInteractorId,
  }));

  const isAutoFocusedNeutral = (() => {
    if (
      !autoFocusSpecifier ||
      autoFocusSpecifier.tag === 'Unknown' ||
      autoFocusSpecifier.tag === 'Star' ||
      autoFocusSpecifier.tag === 'Ship'
    )
      return false;
    return autoFocusSpecifier?.id === objectId;
  })();

  const isAutoFocusedHostile = (() => {
    if (!hostileAutoFocusSpecifier || hostileAutoFocusSpecifier.tag !== 'Ship')
      return false;
    return hostileAutoFocusSpecifier?.id === objectId;
  })();

  useEffect(() => {
    if (active && !isAutoFocusedNeutral) {
      setActiveInteractorId(objectId);
    } else if (activeInteractorId === objectId) {
      setActiveInteractorId(undefined);
    }
  }, [
    active,
    setActiveInteractorId,
    objectId,
    activeInteractorId,
    isAutoFocusedNeutral,
  ]);

  const tempAutoFocusActive = !activeInteractorId && isAutoFocusedNeutral;

  const onLeftClick = (e?: ThreeEvent<MouseEvent>) => {
    if (e) {
      e.stopPropagation();
      if (e.preventDefault) {
        e.preventDefault();
      }
    }
    if (actions && defaultAction) {
      const fn = actions.get(defaultAction);
      if (fn) {
        fn(objectId);
      }
    }
    return false;
  };
  const onContextMenu = (e: ThreeEvent<MouseEvent>) => {
    e.preventDefault();
    setMenuShown(!menuShown);
    return false;
  };

  const visuallyActive = tempAutoFocusActive || active;

  const memoizedColor = useMemo(() => new Color(outlineColor), [outlineColor]);
  const outlineVisible = visuallyActive ? 1.0 : 0.0;
  const setShowTractorCircle = useStore((state) => state.setShowTractorCircle);
  useEffect(() => {
    if (defaultAction === InteractorActionType.Tractor) {
      setShowTractorCircle(active);
    }
  }, [defaultAction, active, setShowTractorCircle]);

  // noinspection RequiredAttributes
  return (
    <group
      onClick={onLeftClick}
      position={[0, 0, radius]}
      onContextMenu={onContextMenu}
      name="three-interactor-main"
    >
      <mesh
        onPointerOver={onPointerOver}
        onPointerOut={onPointerOut}
        name="hover-detector"
      >
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
          {testCompatibleMode ? (
            <mesh name={`text-action-hint=${mapActionToText(defaultAction)}`} />
          ) : (
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
          )}
        </>
      )}
      {!testCompatibleMode && (
        <Html>{active && hint && <HintWindow windowContent={hint} />}</Html>
      )}
      <mesh name="ring">
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
