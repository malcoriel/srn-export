import React from 'react';
import { Substitution } from '../../../world/pkg';
import _ from 'lodash';
import { SubstitutionType } from '../../../world/pkg/world.extra';

type ReactSubPrefab = {
  tagName: string;
  tagChildren?: React.ReactNode;
  className?: string;
};

type SubPrefab = string | SubPrefab[] | ReactSubPrefab;

export const transformLinebreaksStr = (str: string): SubPrefab[] => {
  const parts = str.split('\n');
  const newParts = _.flatten(
    _.zip(
      parts,
      _.times(parts.length, () => ({ tagName: 'br' }))
    )
  ).filter((p) => !!p) as SubPrefab[];
  newParts.pop();

  return newParts;
};

export const transformLinebreaks = (subs: SubPrefab[]): SubPrefab[] => {
  return [];
};

export const transformSubstitutions = (subs: SubPrefab[]): SubPrefab[] => {
  return [];
};

export const enrichSub = (s: Substitution): ReactSubPrefab | null => {
  switch (s.s_type) {
    case SubstitutionType.PlanetName: {
      return {
        tagName: 'span',
        className: 'sub-planet found',
        tagChildren: s.text,
      };
    }
    case SubstitutionType.CharacterName:
      return {
        tagName: 'span',
        className: 'sub-character',
        tagChildren: s.text,
      };
    case SubstitutionType.Generic:
      return {
        tagName: 'span',
        className: 'sub-generic',
        tagChildren: s.text,
      };
    case SubstitutionType.Unknown:
    default: {
      console.warn(`Unknown substitution ${s.s_type} text ${s.text}`);
      return {
        tagName: 'span',
        tagChildren: s.text,
      };
    }
  }
};
export const transformSubstitutionsStr = (
  text: string,
  subs: Substitution[]
): SubPrefab[] => {
  const parts = text.split(/s_\w+/);
  const substitutions = subs.map((s, i) => {
    return enrichSub(s);
  });
  return _.flatMap(_.zip(parts, substitutions)).filter(
    (p) => !!p
  ) as SubPrefab[];
};

export const preprocessSubstitutedText = (
  text: string,
  subs: Substitution[]
): SubPrefab[] => {
  return [];
};

export const reactifySubstitutedText = (
  subs: SubPrefab[]
): React.ReactNode[] => {
  const res = [];
  for (let i = 0; i < subs.length; i++) {
    const sub = subs[i];
    if (typeof sub === 'string') {
      res.push(<span key={i}>{sub}</span>);
    }
  }
  return res;
};
