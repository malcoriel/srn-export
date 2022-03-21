import {
  InteractorActionType,
  ThreeInteractorProps,
} from './blocks/ThreeInteractor';
import {
  containerHintContent,
  mineralHintContent,
} from '../HtmlLayers/HintWindow';
import { common, rare } from '../utils/palette';
import _ from 'lodash';
import { rarityToColor } from './MineralsLayer';
import { actionsActive } from '../utils/ShipControls';
import {
  LongActionStartBuilder,
  ActionBuilder,
  ShootTargetBuilder,
} from '../../../world/pkg/world.extra';
import NetState from '../NetState';
import { Ability, Planet } from '../../../world/pkg';

const planetActionMap = new Map([
  [
    InteractorActionType.Dock,
    (objectId: string) => {
      const ns = NetState.get();
      const shipId = ns?.indexes?.myShip?.id;
      if (shipId) {
        actionsActive.Navigate = ActionBuilder.ActionDockNavigate({
          target: objectId,
          ship_id: shipId,
        });
      }
    },
  ],
]);

const unlandablePlanetActionMap = new Map();

const shipActionMap = new Map([
  [
    InteractorActionType.Shoot,
    (id: string, ability?: Ability) => {
      const ns = NetState.get();
      if (!ns || !ability || ability.tag !== 'Shoot') {
        return;
      }
      ns.startLongAction(
        LongActionStartBuilder.LongActionStartShoot({
          target: ShootTargetBuilder.ShootTargetShip({ id }),
          turret_id: ability.turret_id,
        })
      );
    },
  ],
]);

export const containerActionsMap = new Map([
  [
    InteractorActionType.Tractor,
    (objectId: string) => {
      const ns = NetState.get();
      const shipId = ns?.indexes?.myShip?.id;
      if (shipId) {
        actionsActive.Tractor = ActionBuilder.ActionTractor({
          ship_id: shipId,
          target: objectId,
        });
      }
    },
  ],
  [
    InteractorActionType.Shoot,
    (objectId: string, ability?: Ability) => {
      const ns = NetState.get();
      if (ns && ability && ability.tag === 'Shoot') {
        ns.startLongAction(
          LongActionStartBuilder.LongActionStartShoot({
            target: ShootTargetBuilder.ShootTargetContainer({ id: objectId }),
            turret_id: ability.turret_id,
          })
        );
      }
    },
  ],
]);

export const mineralActionsMap = new Map([
  [
    InteractorActionType.Tractor,
    (objectId: string) => {
      const ns = NetState.get();
      const shipId = ns?.indexes?.myShip?.id;
      if (shipId) {
        actionsActive.Tractor = ActionBuilder.ActionTractor({
          target: objectId,
          ship_id: shipId,
        });
      }
    },
  ],
  [
    InteractorActionType.Shoot,
    (objectId: string, ability?: Ability) => {
      const ns = NetState.get();
      if (ns && ability && ability.tag === 'Shoot') {
        ns.startLongAction(
          LongActionStartBuilder.LongActionStartShoot({
            target: ShootTargetBuilder.ShootTargetMineral({ id: objectId }),
            turret_id: ability.turret_id,
          })
        );
      }
    },
  ],
]);
export const InteractorMap: Record<
  string,
  (obj: any) => ThreeInteractorProps
> = {
  container: _.memoize(
    (_u) => ({
      hint: containerHintContent(),
      defaultAction: InteractorActionType.Tractor,
      outlineColor: rare,
      actions: containerActionsMap,
    }),
    (u) => u.id
  ),
  mineral: _.memoize(
    (m) => ({
      hint: mineralHintContent(m),
      defaultAction: InteractorActionType.Tractor,
      outlineColor: rarityToColor(m.rarity),
      actions: mineralActionsMap,
    }),
    (m) => m.id
  ),
  planet: _.memoize(
    (p: Planet) => {
      const isUnlandable = p.properties.find(
        (v) => v.tag === 'UnlandablePlanet'
      );
      return {
        hint: null,
        defaultAction: isUnlandable ? undefined : InteractorActionType.Dock,
        outlineColor: common,
        actions: isUnlandable ? unlandablePlanetActionMap : planetActionMap,
      };
    },
    (m) => m.id
  ),
  ship: _.memoize(
    (_p) => ({
      hint: null,
      defaultAction: InteractorActionType.Shoot,
      outlineColor: common,
      actions: shipActionMap,
      // hostile: true,
    }),
    (m) => m.id
  ),
  myShip: _.memoize(
    (_p) => ({
      hint: null,
      defaultAction: undefined,
      outlineColor: common,
      actions: new Map(),
      // hostile: true,
    }),
    (m) => m.id
  ),
};
