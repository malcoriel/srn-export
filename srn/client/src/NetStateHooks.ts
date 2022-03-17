import { useEffect, useState } from 'react';
import _ from 'lodash';
import NetState from './NetState';
import { GameState } from './world';

export type ShouldUpdateStateChecker = (
  prev: GameState,
  next: GameState
) => boolean;
export const useNSForceChange = (
  name: string,
  fast = false,
  shouldUpdate: ShouldUpdateStateChecker = () => true,
  throttle?: number
): NetState | null => {
  const [, forceChange] = useState(false);
  const ns = NetState.get();
  if (!ns) return null;
  useEffect(() => {
    let listener = (prevState: GameState, nextState: GameState) => {
      if (
        prevState &&
        nextState &&
        // @ts-ignore
        shouldUpdate
      ) {
        if (shouldUpdate(prevState, nextState)) {
          forceChange((flip) => !flip);
        }
      } else {
        forceChange((flip) => !flip);
      }
    };
    if (throttle) {
      listener = _.throttle(listener, throttle);
    }
    const event = fast ? 'change' : 'slowchange';
    ns.on(event, listener);
    return () => {
      ns.off(event, listener);
    };
  }, [ns.id, fast, ns, shouldUpdate, throttle]);
  return ns;
};
