import { QuickMenu } from './QuickMenu';
import React, { useState } from 'react';
import NetState, { useNSForceChange } from '../NetState';
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
  GiStarProminences,
  GiStarSattelites,
  IoIosSpeedometer,
  SiGodotengine,
} from 'react-icons/all';

const pickClosestObject = (state: GameState): undefined => {
  return undefined;
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
  const [anchor, setAnchor] = useState(undefined);

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
      handler: () => setAnchor(pickClosestObject(ns.state)),
    },
    {
      text: `Add a ${planetType} planet sp. ${planetSpeed}`,
      icon: <BiPlanet />,
      handler: () =>
        ns.sendSandboxCmd({
          [SandboxCommandName.AddPlanet]: {
            p_type: planetType,
          },
        }),
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
      text: 'Toggle god mode',
      icon: <SiGodotengine />,
      handler: () => ns.sendSandboxCmd(SandboxCommandName.ToggleGodMode),
    },
  ];

  if (!show) return null;

  return <QuickMenu startActions={actions} mainHotkey="g" />;
};
