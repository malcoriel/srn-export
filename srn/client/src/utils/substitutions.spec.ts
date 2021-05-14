// @ts-ignore
global.wasmFunctions = { set_panic_hook: () => {} };
import 'core-js/stable';
import 'regenerator-runtime/runtime';
import {
  transformAllIntoPrefabs,
  transformLinebreaksStr,
  transformSubstitutionsStr,
} from './substitutions';
import { SubstitutionType } from '../world';

describe('substitution functions', () => {
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
    const res = transformSubstitutionsStr('qq s_1 ww s_2', [
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
        id: '1',
        tagName: 'span',
        tagChildren: 'PLANET',
        className: 'sub-planet found',
      },
      ' ww ',
      {
        id: '2',
        tagName: 'span',
        tagChildren: 'GENERIC',
        className: 'sub-generic',
      },
    ]);
  });

  it('can transform both linebreaks and subs', () => {
    const res = transformAllIntoPrefabs('qq s_1\nww s_2 \n 12s_3', [
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
        id: '1',
        tagChildren: 'PLANET',
        className: 'sub-planet found',
      },
      { tagName: 'br' },
      'ww ',
      {
        tagName: 'span',
        id: '2',
        tagChildren: 'GENERIC',
        className: 'sub-generic',
      },
      ' ',
      {
        tagName: 'br',
      },
      ' 12s_3',
    ]);
  });
});
