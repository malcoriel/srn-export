import { saveAs } from 'file-saver';
import { QuickMenu } from './ui/QuickMenu';
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
  BiReset,
  CgCodeClimate,
  FaCreativeCommonsZero,
  FaShapes,
  GiAppleSeeds,
  GiCardJoker,
  GiStarProminences,
  GiStarSattelites,
  GiWoodenCrate,
  ImFloppyDisk,
  IoIosSpeedometer,
  RiDownloadCloudLine,
  RiUploadCloudLine,
  SiGodotengine,
} from 'react-icons/all';
import Vector from '../utils/Vector';
import _ from 'lodash';
import { FaDiceD20 } from 'react-icons/fa';
import { api } from '../utils/api';
import { usePrompt } from './PromptWindow';

const pickClosestObject = (
  state: GameState,
  visualState: VisualState
): string => {
  const myShip = findMyShip(state);
  const from = Vector.fromIVector(myShip || visualState.cameraPosition);
  if (!myShip) return '';
  const withDist = [state.locations[0].star, ...state.locations[0].planets]
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
  const inputPrompt = usePrompt();
  const [planetType, setPlanetType] = useState(PlanetType.Barren);
  const [planetSpeed, setPlanetSpeed] = useState(0.05);
  const [anchor, setAnchor] = useState('initial');
  useEffect(() => {}, [anchor]);

  const savedStates = api.useSavedStates();

  const actions = [
    {
      text: 'Load/save states',
      icon: <ImFloppyDisk />,
      children: [
        {
          text: 'Load to current state',
          icon: <RiDownloadCloudLine />,
          list: true,
          children: savedStates.map(([name, id]: [string, string]) => {
            return {
              text: `${name} (${id})`,
              handler: () => api.loadSavedState(ns.state.my_id, id),
            };
          }),
        },
        {
          text: 'Save to server',
          icon: <RiUploadCloudLine />,
          handler: async () => {
            try {
              const name = await inputPrompt('name of the saved state');
              return await api.saveSavedState(ns.state.my_id, name);
            } catch (e) {
              console.log('user cancelled prompt', e);
            }
          },
        },
        {
          text: 'Generate random',
          icon: <FaDiceD20 />,
          handler: () => api.loadRandomState(ns.state.my_id),
        },
        {
          text: 'Generate from seed',
          icon: <GiAppleSeeds />,
          handler: async () => {
            try {
              const seed = await inputPrompt('seed (any string)');
              return await api.loadSeededState(ns.state.my_id, seed);
            } catch (e) {
              console.log('user cancelled prompt', e);
            }
          },
        },
        {
          text: 'Save current state as json',
          icon: <ImFloppyDisk />,
          handler: async () => {
            const json = await api.downloadStateAsJson(ns.state.my_id);
            console.log('downloaded', json);
            saveAs(
              new Blob([JSON.stringify(json, null, 2)]),
              'current_state.json'
            );
          },
        },
        {
          text: 'Reset',
          icon: <BiReset />,
          handler: () => api.loadCleanState(ns.state.my_id),
        },
      ],
    },
    {
      text: 'Add objects',
      icon: <FaShapes />,
      children: [
        {
          text: 'Add a star',
          icon: <GiStarProminences />,
          handler: () => ns.sendSandboxCmd(SandboxCommandName.AddStar),
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
      ],
    },
    {
      text: 'Select anchor for actions',
      noHide: true,
      icon: <GiStarSattelites />,
      handler: () => {
        const closest = pickClosestObject(ns.state, ns.visualState);
        setAnchor(() => closest);
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
