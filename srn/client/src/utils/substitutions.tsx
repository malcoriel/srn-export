import React from 'react';
import { Substitution } from '../../../world/pkg';
import _ from 'lodash';
import { SubstitutionType } from '../../../world/pkg/world.extra';
import '../HtmlLayers/substitutions.scss';

type ReactSubPrefab = {
  tagName: string;
  targetId: string | null;
  id: string;
  tagChildren?: React.ReactNode;
  className?: string;
  clickable?: boolean;
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

export const transformLinebreaks = (prefabs: SubPrefab[]): SubPrefab[] => {
  return _.flatMap(prefabs, (p) => {
    if (typeof p === 'string') {
      return transformLinebreaksStr(p);
    }
    if (_.isArray(p)) {
      return transformLinebreaks(p);
    }
    console.warn('Unsupported transform case for transformLinebreaks', p);
    return p;
  }).filter((p) => !!p);
};

export const enrichSub = (s: Substitution): ReactSubPrefab | null => {
  switch (s.s_type) {
    case SubstitutionType.PlanetName: {
      return {
        tagName: 'span',
        className: 'sub-planet found',
        tagChildren: s.text,
        clickable: true,
        id: s.id,
        targetId: s.target_id,
      };
    }
    case SubstitutionType.CharacterName:
      return {
        id: s.id,
        tagName: 'span',
        className: 'sub-character',
        tagChildren: s.text,
        targetId: s.target_id,
      };
    case SubstitutionType.Generic:
      return {
        id: s.id,
        tagName: 'span',
        className: 'sub-generic',
        tagChildren: s.text,
        targetId: s.target_id,
      };
    case SubstitutionType.Unknown:
    default: {
      console.warn(`Unknown substitution ${s.s_type} text ${s.text}`);
      return {
        id: s.id,
        tagName: 'span',
        tagChildren: s.text,
        targetId: s.target_id,
      };
    }
  }
};

const SUB_RE = /s_([-\w]+)/;

export const transformSubstitutionsStr = (
  text: string,
  subs: Substitution[]
): SubPrefab[] => {
  const subsById = _.keyBy(
    subs.map((s, i) => {
      return enrichSub(s);
    }),
    'id'
  );

  const result = [];
  for (let i = 0; i < text.length; i++) {
    const remaining = text.slice(i);
    // console.log(`remaining '${remaining}'`);
    const match = remaining.match(SUB_RE);
    if (match) {
      const matchedStr = match[0];
      // console.log('match at', i, matchedStr);
      const index = match.index;
      if (index === undefined) {
        console.warn('match with no index', match);
        break;
      }
      result.push(text.slice(i, i + index));
      const subId = match[1] || 'unknown';
      const matchingSub = subsById[subId];
      if (matchingSub) {
        result.push(matchingSub);
        i = i + index + matchedStr.length - 1;
        // console.log('sub found', index, matchedStr.length);
        // console.log('jump to', i);
      } else {
        if (_.isString(result[result.length - 1])) {
          result[result.length - 1] += matchedStr;
        } else {
          // console.warn(`sub not found id ${subId}`, index, matchedStr.length);
          result.push(matchedStr);
        }
        i = i + index + matchedStr.length - 1;
        // console.log('jump to', i);
      }
    } else {
      result.push(remaining);
      break;
    }
  }
  return result;
};

export const transformSubstitutions = (
  prefabs: SubPrefab[],
  subs: Substitution[]
): SubPrefab[] => {
  return _.flatMap(prefabs, (p) => {
    if (_.isString(p)) {
      return transformSubstitutionsStr(p, subs);
    }
    if (_.isArray(p)) {
      return transformSubstitutions(p, subs);
    }
    if (p.tagName === 'br') {
      return p;
    }
    console.warn('Unsupported transform case for transformSubstitutions', p);
    return p;
  });
};

export const preprocessSubstitutedText = (text: string): SubPrefab[] => {
  return [text];
};

export const reactifyPrefabs = (
  subs: SubPrefab[],
  handlers?: SubstitutionInteractionHandlers
): React.ReactNode[] => {
  const res = [];
  for (let i = 0; i < subs.length; i++) {
    const sub = subs[i];
    if (_.isString(sub)) {
      res.push(<span>{sub}</span>);
    } else if (_.isArray(sub)) {
      res.push(...reactifyPrefabs(sub, handlers));
    } else if (sub.tagName) {
      const onFocusImpl = () => {
        if (handlers && handlers.onFocusObject && sub.targetId) {
          return handlers.onFocusObject(sub.targetId);
        }
      };
      const onClick =
        sub.clickable && handlers && handlers.onFocusObject
          ? onFocusImpl
          : Function.prototype;
      res.push(
        React.createElement(
          sub.tagName,
          { className: sub.className, onClick },
          sub.tagChildren
        )
      );
    }
  }
  return res;
};

export const transformAllIntoPrefabs = (
  str: string,
  subs: Substitution[]
): SubPrefab[] => {
  let res = preprocessSubstitutedText(str);
  res = transformLinebreaks(res);
  res = transformSubstitutions(res, subs);
  return res;
};

export type SubstitutionInteractionHandlers = {
  onFocusObject?: (id: string) => void;
};
export const transformAllTextSubstitutions = (
  str: string,
  subs: Substitution[],
  handlers?: SubstitutionInteractionHandlers
): React.ReactNode[] => {
  const prefabs = transformAllIntoPrefabs(str, subs);
  return reactifyPrefabs(prefabs, handlers);
};
