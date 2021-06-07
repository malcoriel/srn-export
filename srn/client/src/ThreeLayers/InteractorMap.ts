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
import { ShipAction, ShipActionType } from '../world';

const planetActionMap = new Map([
  [
    InteractorActionType.Dock,
    (objectId: string) => {
      actionsActive[ShipActionType.DockNavigate] = ShipAction.DockNavigate(
        objectId
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
    (p) => ({
      hint: null,
      defaultAction: InteractorActionType.Dock,
      outlineColor: common,
      actions: planetActionMap,
    }),
    (m) => m.id
  ),
};
