import React, { ReactNode } from 'react';
import { Planet, Substitution } from '../../../world/pkg';
import _ from 'lodash';
import NetState from '../NetState';
import { SubstitutionType } from '../../../world/pkg/world.extra';
import { findPlanet } from '../world';

type ReactPrefab = {
  tagName: string;
  tagChildren?: React.ReactNode;
};

type SubPrefab = string | SubPrefab[] | ReactPrefab;

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

export const enrichSub = (s: Substitution): ReactNode => {
  const ns = NetState.get();
  if (!ns) return null;

  const { visualState } = ns;

  const focus = (p: Planet) => {
    visualState.cameraPosition = { x: p.x, y: p.y };
    visualState.boundCameraMovement = false;
  };

  switch (s.s_type) {
    case SubstitutionType.PlanetName: {
      const planet = findPlanet(ns.state, s.id);
      if (!planet) {
        console.warn(`substitution planet not found by id ${s.id}`);
        return <span className="sub-planet">{s.text}</span>;
      }
      return (
        <span className="sub-planet found" onClick={() => focus(planet!)}>
          {s.text}
        </span>
      );
    }
    case SubstitutionType.CharacterName:
      return <span className="sub-character">{s.text}</span>;
    case SubstitutionType.Generic:
      return <span className="sub-generic">{s.text}</span>;
    case SubstitutionType.Unknown:
    default: {
      console.warn(`Unknown substitution ${s.s_type} text ${s.text}`);
      return <span>{s.text}</span>;
    }
  }
};
export const transformSubstitutionsStr = (
  text: string,
  subs: Substitution[]
): SubPrefab[] => {
  const parts = text.split(/s_\w+/);
  const substitutions = subs.map((s, i) => {
    return <span key={i}>{enrichSub(s)}</span>;
  });
  return [];
  // return _.flatMap(_.zip(parts, substitutions), (elem, i) => (
  //   <span key={i}>{elem}</span>
  // ));
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
