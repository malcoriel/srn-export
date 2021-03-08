import { QuickMenu } from './QuickMenu';
import React, { useEffect, useState } from 'react';
import NetState, {
  findMyShip,
  useNSForceChange,
  VisualState,
} from '../NetState';
import {
  GameMode,
  GameState,
  PlanetType,
  SandboxCommandName,
  SandboxTeleportTarget,
} from '../world';
import {
  BiPlanet,
  CgCodeClimate,
  FaCreativeCommonsZero,
  GiCardJoker,
  GiStarProminences,
  GiStarSattelites,
  GiWoodenCrate,
  IoIosSpeedometer,
  SiGodotengine,
} from 'react-icons/all';
import Vector from '../utils/Vector';
import _ from 'lodash';

const pickClosestObject = (
  state: GameState,
  visualState: VisualState
): string => {
  const myShip = findMyShip(state);
  const from = Vector.fromIVector(myShip || visualState.cameraPosition);
  if (!myShip) return '';
  const withDist = [state.star, ...state.planets]
    .map((obj) => {
      if (!obj) {
        return null;
      }
      const objPos = Vector.fromIVector(obj);
      return [obj.id, objPos.euDistTo(from)];
    })
    .filter((s) => !!s) as [string, number][];
  const sorted = _.sortBy(withDist, (p) => p[1]);
  return _.get(sorted, '0.0', '');
};

const cyclePlanetType = (pt: PlanetType) => {
  if (pt === PlanetType.Barren) {
    return PlanetType.Ice;
  }
  return PlanetType.Barren;
};

const cyclePlanetSpeed = (sp: number) => {
  if (sp === 0.05) {
    return 0.1;
  }
  return 0.05;
};

export const SandboxQuickMenu = () => {
  const ns = NetState.get();
  if (!ns) return null;
  const show = ns.state.mode === GameMode.Sandbox;
  useNSForceChange('SandboxQuickMenu', false, (oldState, newState) => {
    return oldState.mode !== newState.mode;
  });

  const [planetType, setPlanetType] = useState(PlanetType.Barren);
  const [planetSpeed, setPlanetSpeed] = useState(0.05);
  const [anchor, setAnchor] = useState('initial');
  useEffect(() => {}, [anchor]);

  const actions = [
    {
      text: 'Add a star',
      icon: <GiStarProminences />,
      handler: () => ns.sendSandboxCmd(SandboxCommandName.AddStar),
    },
    {
      text: 'Set anchor',
      noHide: true,
      icon: <GiStarSattelites />,
      handler: () => {
        const closest = pickClosestObject(ns.state, ns.visualState);
        setAnchor(() => closest);
      },
    },
    {
      text: `Add a ${planetType} planet sp. ${planetSpeed}`,
      icon: <BiPlanet />,
      handler: () => {
        if (anchor) {
          ns.sendSandboxCmd({
            [SandboxCommandName.AddPlanet]: {
              p_type: planetType,
              radius: 5.0,
              anchor_id: anchor,
              orbit_speed: planetSpeed,
            },
          });
        }
      },
    },
    {
      text: 'Toggle planet type',
      noHide: true,
      icon: <CgCodeClimate />,
      handler: () => {
        setPlanetType((pt) => {
          return cyclePlanetType(pt);
        });
      },
    },
    {
      text: 'Toggle planet speed',
      noHide: true,
      icon: <IoIosSpeedometer />,
      handler: () => {
        setPlanetSpeed((pt) => {
          return cyclePlanetSpeed(pt);
        });
      },
    },
    {
      text: 'Move to zero',
      icon: <FaCreativeCommonsZero />,
      handler: () =>
        ns.sendSandboxCmd({
          [SandboxCommandName.Teleport]: {
            target: SandboxTeleportTarget.Zero,
          },
        }),
    },
    {
      text: 'Cheats',
      icon: <GiCardJoker />,
      children: [
        {
          text: 'Toggle god mode',
          icon: <SiGodotengine />,
          handler: () => ns.sendSandboxCmd(SandboxCommandName.ToggleGodMode),
        },
        {
          text: 'Get some wares',
          icon: <GiWoodenCrate />,
          handler: () => ns.sendSandboxCmd(SandboxCommandName.GetSomeWares),
        },
      ],
    },
  ];
  if (!show) return null;
  return <QuickMenu startActions={actions} mainHotkey="g" />;
};
