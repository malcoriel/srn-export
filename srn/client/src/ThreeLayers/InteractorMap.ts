import {
  InteractorActionType,
  ThreeInteractorProps,
} from './blocks/ThreeInteractor';
import {
  containerHintContent,
  mineralHintContent,
} from '../HtmlLayers/HintWindow';
import { rare } from '../utils/palette';
import { containerActionsMap } from './ContainersLayer';
import _ from 'lodash';
import { mineralActionsMap, rarityToColor } from './MineralsLayer';

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
};
