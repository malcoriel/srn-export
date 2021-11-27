import {
  InteractorActionType,
  ThreeInteractorProps,
} from './blocks/ThreeInteractor';
import {
  containerHintContent,
  mineralHintContent,
} from '../HtmlLayers/HintWindow';
import { common, rare } from '../utils/palette';
import { containerActionsMap } from './ContainersLayer';
import _ from 'lodash';
import { mineralActionsMap, rarityToColor } from './MineralsLayer';
import { actionsActive } from '../utils/ShipControls';
import {
  LongActionStartBuilder,
  ShipActionRustBuilder,
  ShootTargetBuilder,
} from '../../../world/pkg/world.extra';
import NetState from '../NetState';

const planetActionMap = new Map([
  [
    InteractorActionType.Dock,
    (objectId: string) => {
      actionsActive.Navigate = ShipActionRustBuilder.ShipActionRustDockNavigate(
        { target: objectId }
      );
    },
  ],
]);

const shipActionMap = new Map([
  [
    InteractorActionType.Shoot,
    (id: string) => {
      const ns = NetState.get();
      if (!ns) {
        return;
      }
      ns.startLongAction(
        LongActionStartBuilder.LongActionStartShoot({
          target: ShootTargetBuilder.ShootTargetShip({ id }),
        })
      );
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
    (_p) => ({
      hint: null,
      defaultAction: InteractorActionType.Dock,
      outlineColor: common,
      actions: planetActionMap,
    }),
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
