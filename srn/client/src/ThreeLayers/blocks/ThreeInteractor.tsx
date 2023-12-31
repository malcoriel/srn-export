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
import { suppressEvent } from '../suppressEvent';
// eslint-disable-next-line import/named
import { Ability } from '../../../../world/pkg/world';
import { useScopedHotkey } from '../../utils/hotkeyHooks';

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

const mapActionToHotkey = (t: InteractorActionType) => {
  if (t === InteractorActionType.Shoot) {
    return '1';
  }
  return 'E';
};

export type InteractorActionFn = (objectId: string, ability?: Ability) => void;

export interface ThreeInteractorProps {
  actions?: Map<InteractorActionType, InteractorActionFn>;
  hint?: ReactNode;
  outlineThickness?: number;
  outlineColor?: string;
  defaultAction?: InteractorActionType;
  hostile?: boolean;
}

const DEFAULT_OUTLINE_THICKNESS = 0.1;
const DEFAULT_OUTLINE_COLOR = 'red';

const KbAction: React.FC<{
  action?: InteractorActionFn;
  hotkey: string;
  objectId: string;
}> = ({ objectId, action, hotkey }) => {
  useScopedHotkey(
    hotkey,
    () => {
      if (!action) {
        return;
      }
      action(objectId);
    },
    'game',
    {},
    []
  );
  return null;
};

const ThreeInteractorImpl = ({
  objectId,
  radius,
  testCompatibleMode = false,
  interactor: {
    outlineThickness = DEFAULT_OUTLINE_THICKNESS,
    outlineColor = DEFAULT_OUTLINE_COLOR,
    actions,
    hint,
    defaultAction,
    hostile,
  },
}: {
  // eslint-disable-next-line react/no-unused-prop-types
  perfId: string;
  objectId: string;
  radius: number;
  testCompatibleMode?: boolean;
  interactor: ThreeInteractorProps;
}) => {
  const [hovered, setHovered] = useState(false);
  const [menuShown, setMenuShown] = useState(false);
  const onPointerOver = () => {
    setHovered(true);
  };
  const onPointerOut = () => {
    setHovered(false);
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
    if (!autoFocusSpecifier || autoFocusSpecifier.tag === 'Unknown')
      return false;
    return autoFocusSpecifier?.id === objectId;
  })();

  const isAutoFocusedHostile = (() => {
    if (
      !hostileAutoFocusSpecifier ||
      hostileAutoFocusSpecifier.tag === 'Unknown'
    )
      return false;
    return hostileAutoFocusSpecifier?.id === objectId;
  })();

  useEffect(() => {
    // sync global state with local hover state
    // important thing here is to only 'touch' the group it belongs to, so focusing hostile
    // interactor would not touch neutral autofocus, and vice-versa
    if (hostile) {
      if (hovered && !isAutoFocusedHostile) {
        setActiveHostileInteractorId(objectId);
      } else if (activeHostileInteractorId === objectId) {
        setActiveHostileInteractorId(undefined);
      }
    } else {
      // eslint-disable-next-line no-lonely-if
      if (hovered && !isAutoFocusedNeutral) {
        setActiveInteractorId(objectId);
      } else if (activeInteractorId === objectId) {
        setActiveInteractorId(undefined);
      }
    }
  }, [
    hostile,
    hovered,
    setActiveInteractorId,
    objectId,
    activeInteractorId,
    isAutoFocusedNeutral,
    setActiveHostileInteractorId,
    activeHostileInteractorId,
    isAutoFocusedHostile,
  ]);

  const tempAutoFocusActive =
    (!activeInteractorId && isAutoFocusedNeutral) ||
    (!activeHostileInteractorId && isAutoFocusedHostile);

  const onLeftClick = (e?: ThreeEvent<MouseEvent>) => {
    if (actions && defaultAction) {
      const fn = actions.get(defaultAction);
      if (fn) {
        fn(objectId);
        suppressEvent(e);
      }
    }
    return false;
  };
  const onContextMenu = (e: ThreeEvent<MouseEvent>) => {
    suppressEvent(e);
    setMenuShown(!menuShown);
    return false;
  };

  const visuallyActive = tempAutoFocusActive || hovered;

  const memoizedColor = useMemo(() => new Color(outlineColor), [outlineColor]);
  const outlineVisible = visuallyActive ? 1.0 : 0.0;
  const setShowTractorCircle = useStore((state) => state.setShowTractorCircle);
  useEffect(() => {
    if (defaultAction === InteractorActionType.Tractor) {
      setShowTractorCircle(hovered);
    }
  }, [defaultAction, hovered, setShowTractorCircle]);

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
        name={`hover-detector-${objectId}`}
      >
        <circleBufferGeometry args={[radius, 16]} />
        <meshBasicMaterial opacity={0.0} transparent />
      </mesh>
      {visuallyActive && defaultAction && (
        <>
          <KbAction
            action={actions && actions.get(defaultAction)}
            objectId={objectId}
            hotkey={mapActionToHotkey(defaultAction).toLowerCase()}
          />
          {testCompatibleMode ? (
            <mesh name={`text-action-hint=${mapActionToText(defaultAction)}`} />
          ) : (
            <Text
              visible
              position={vecToThreePos(VectorF(0, -(radius + 6)))}
              color={teal}
              font="resources/fonts/DejaVuSans.ttf"
              fontSize={1.5}
              maxWidth={20}
              lineHeight={1}
              letterSpacing={0.02}
              textAlign="left"
              anchorX="center"
              anchorY="bottom"
            >
              Press {mapActionToHotkey(defaultAction)} to{' '}
              {mapActionToText(defaultAction)}
            </Text>
          )}
        </>
      )}
      {!testCompatibleMode && (
        <Html>{hovered && hint && <HintWindow windowContent={hint} />}</Html>
      )}
      <mesh name={`ring-${objectId}-${outlineVisible ? 'visible' : 'hidden'}`}>
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

ThreeInteractorImpl.defaultProps = {
  testCompatibleMode: false,
};

export const ThreeInteractor = UpdateStrategy(
  ThreeInteractorImpl,
  'ThreeInteractor',
  UpdateStrategyBuilder.NoInvisibleUpdate()
);
