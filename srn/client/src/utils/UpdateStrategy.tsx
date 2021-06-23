// @ts-ignore
import React from 'react';
import { Perf, PERF_COUNTERS_ENABLED } from '../HtmlLayers/Perf';
import { shallowEqual } from './shallowCompare';

type Always = {
  type: 'Always';
};

export class UpdateStrategyBuilder {
  static Always(): Always {
    return {
      type: 'Always',
    };
  }

  static NoInvisibleUpdate(): NoInvisibleUpdate {
    return {
      type: 'NoInvisibleUpdate',
    };
  }
}

type NoInvisibleUpdate = {
  type: 'NoInvisibleUpdate';
};

export type Strategy = Always | NoInvisibleUpdate;

const shouldBlockUpdate = (
  strategy: Always | NoInvisibleUpdate,
  prev: any,
  next: any
) => {
  if (strategy.type === 'NoInvisibleUpdate') {
    if (
      prev &&
      typeof prev.visibile === 'boolean' &&
      !prev.visible &&
      next &&
      !next.visible
    ) {
      return true;
    }
    return shallowEqual(prev, next);
  }
  return shallowEqual(prev, next);
};

export const UpdateStrategy = <CProps extends any>(
  Cmp: React.FunctionComponent<CProps>,
  name: string,
  strategy: Strategy
): React.MemoExoticComponent<React.FunctionComponent<CProps>> => {
  return React.memo(Cmp, (prevP, nextP) => {
    const prev = prevP as any;
    const next = nextP as any;
    const propsAreEqual = shouldBlockUpdate(strategy, prev, next);
    if (PERF_COUNTERS_ENABLED && !propsAreEqual) {
      const perfId = (next as any).perfId;
      const counterName = `${name}${perfId ? `-${perfId}` : ''}`;
      Perf.markCounter(counterName);
    }
    return propsAreEqual;
  });
};
