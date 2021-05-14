// @ts-ignore
global.wasmFunctions = { set_panic_hook: () => {} };
import 'core-js/stable';
import 'regenerator-runtime/runtime';
import {
  transformLinebreaksStr,
  transformSubstitutionsStr,
} from './substitutions';
import { SubstitutionType } from '../world';

describe('transformLinebreaksStr', () => {
  it('can insert brs', () => {
    const res = transformLinebreaksStr('qq\nww');
    expect(res).toEqual([
      'qq',
      {
        tagName: 'br',
      },
      'ww',
    ]);
  });

  it('can replace subs', () => {
    const res = transformSubstitutionsStr('qq s_11 ww s22', [
      {
        s_type: SubstitutionType.PlanetName,
        id: '1',
        text: 'PLANET',
      },
      {
        s_type: SubstitutionType.Generic,
        id: '2',
        text: 'GENERIC',
      },
    ]);
    expect(res).toEqual([
      'qq ',
      {
        tagName: 'span',
        tagChildren: 'PLANET',
      },
      ' ww ',
      {
        tagName: 'span',
        tagChildren: 'GENERIC',
      },
    ]);
  });
});
