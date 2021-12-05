import React from 'react';
import { useStore } from '../../store';

export const ZustandStateListener: React.FC<{
  fields: string[];
  hooks?: string[];
}> = ({ fields, hooks }) => {
  const values: Record<string, any> = useStore((s) => {
    const res = {};
    for (const f of fields) {
      // @ts-ignore
      res[f] = s[f];
    }
    return res;
  });
  if (hooks) {
    for (const hookName of hooks) {
      const hook = require('../../store')[hookName];
      const hookValues = hook();
      for (const pair of Object.entries(hookValues)) {
        const [k, v] = pair;
        values[k] = v;
      }
    }
  }
  return (
    <div>
      {Object.entries(values).map(([k, v], i) => {
        return (
          <div key={i}>
            <span>{k}:</span>
            <span>{v ? JSON.stringify(v) : 'falsy'}</span>
          </div>
        );
      })}
    </div>
  );
};
