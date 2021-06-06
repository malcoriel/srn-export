import React from 'react';
import _ from 'lodash';
import { GameState, ShipAction, ShipActionType } from '../world';
import { ThreeStar } from './ThreeStar';
import { posToThreePos } from './ThreeLayer';
import { ThreeAsteroidBelt } from './ThreeAsteroidBelt';
import { ThreeFloatingObject } from './ThreeFloatingObject';
import {
  ThreePlanetShape,
  ThreePlanetShapeRandomProps,
} from './ThreePlanetShape';
import { actionsActive } from '../utils/ShipControls';
import NetState, { VisualState } from '../NetState';
import { InteractorActionType } from './blocks/ThreeInteractor';
import { common, rare, uncommon } from '../utils/palette';
import {
  LongActionStartBuilder,
  Rarity,
  ShootTargetBuilder,
} from '../../../world/pkg/world.extra';
import { UnreachableCaseError } from 'ts-essentials';
import {
  containerHintContent,
  mineralHintContent,
} from '../HtmlLayers/HintWindow';

// from random_stuff.rs
export const possibleGasGiantColors = [
  '#0D57AC',
  '#AE213D',
  '#DE4C0A',
  '#05680D',
  '#01A6A0',
  '#9D91A1',
  '#AA6478',
  '#4D56A5',
  '#382C4F',
  '#AC54AD',
  '#8D948D',
  '#A0B472',
  '#C7B4A6',
  '#1D334A',
  '#5BBAA9',
  '#008FA9',
  '#ADBEA3',
  '#F5B0A1',
  '#A1A70B',
  '#025669',
  '#AE2460',
  '#955802',
  '#9C46B8',
  '#DE019B',
  '#DC890C',
  '#F68923',
  '#F4A261',
  '#E76F51',
  '#849324',
  '#FD151B',
  '#D8A47F',
  '#EF8354',
];

const mineralActionsMap = new Map([
  [
    InteractorActionType.Tractor,
    (objectId: string) => {
      actionsActive[ShipActionType.Tractor] = ShipAction.Tractor(objectId);
    },
  ],
  [
    InteractorActionType.Shoot,
    (objectId: string) => {
      const ns = NetState.get();
      if (ns) {
        ns.startLongAction(
          LongActionStartBuilder.LongActionStartShoot({
            target: ShootTargetBuilder.ShootTargetMineral({ id: objectId }),
          })
        );
      }
    },
  ],
]);

const containerActionsMap = new Map([
  [
    InteractorActionType.Tractor,
    (objectId: string) => {
      actionsActive[ShipActionType.Tractor] = ShipAction.Tractor(objectId);
    },
  ],
]);

const rarityToColor = (rarity: Rarity): string => {
  switch (rarity) {
    case Rarity.Unknown:
      return 'white';
    case Rarity.Common:
      return common;
    case Rarity.Uncommon:
      return uncommon;
    case Rarity.Rare:
      return rare;
    default:
      throw new UnreachableCaseError(rarity);
  }
};

export const ThreeBodiesLayer: React.FC<{
  state: GameState;
  visualState: VisualState;
  visMap: Record<string, boolean>;
}> = ({ visMap, state, visualState }) => {
  const {
    planets,
    star,
    minerals,
    asteroid_belts,
    containers,
  } = state.locations[0];
  // const selectedObjectId = useStore((state) => state.selectedObjectId);
  // const onReportSelected = useStore((state) => state.onReportSelected);

  return (
    <group>
      {planets.map((p) => {
        return (
          <ThreePlanetShape
            radius={p.radius}
            {...ThreePlanetShapeRandomProps(p.id, p.radius)}
            onClick={(evt: MouseEvent) => {
              evt.stopPropagation();
              actionsActive[
                ShipActionType.DockNavigate
              ] = ShipAction.DockNavigate(p.id);
            }}
            position={p}
            key={p.id}
            color={p.color}
            atmosphereColor={p.color}
            visible={visMap[p.id]}
          />
        );
      })}
      {star && (
        <ThreeStar
          key={star.id}
          timeScale={0.5}
          visualState={visualState}
          visible={visMap[star.id]}
          scale={_.times(3, () => star.radius) as [number, number, number]}
          position={posToThreePos(star.x, star.y)}
          color={star.color}
          coronaColor={star.corona_color}
        />
      )}
      {asteroid_belts.map((b) => (
        <ThreeAsteroidBelt
          key={b.id}
          count={b.count}
          radius={b.radius}
          position={posToThreePos(b.x, b.y)}
          width={b.width}
          rotation={[0, 0, b.rotation]}
          gid={b.id}
          scale_mod={b.scale_mod}
        />
      ))}
      {minerals.map((m) => {
        return (
          <ThreeFloatingObject
            gid={m.id}
            key={m.id}
            scale={0.2}
            radius={m.radius}
            position={posToThreePos(m.x, m.y)}
            colors={[rarityToColor(m.rarity)]}
            modelName="asteroid.glb"
            meshes={['2']}
            interactor={{
              hint: mineralHintContent(m),
              defaultAction: InteractorActionType.Tractor,
              outlineColor: rarityToColor(m.rarity),
              actions: mineralActionsMap,
            }}
          />
        );
      })}
      {containers.map((c) => (
        <ThreeFloatingObject
          gid={c.id}
          key={c.id}
          radius={c.radius}
          position={posToThreePos(c.position.x, c.position.y)}
          modelName="container.glb"
          meshes={['0.children.0', '0.children.1', '0.children.2']}
          scale={0.002}
          interactor={{
            hint: containerHintContent(),
            defaultAction: InteractorActionType.Tractor,
            outlineColor: rare,
            actions: containerActionsMap,
          }}
        />
      ))}
      {/*{asteroids.map((a: Asteroid) => (*/}
      {/*  <ThreeRock*/}
      {/*    key={a.id}*/}
      {/*    position={posToThreePos(a.x, a.y)}*/}
      {/*    scale={_.times(3, () => a.radius) as [number, number, number]}*/}
      {/*  />*/}
      {/*))}*/}
    </group>
  );
};
