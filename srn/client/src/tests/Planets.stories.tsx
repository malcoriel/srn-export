import React, { useCallback, useEffect, useState } from 'react';
import { Meta, Story } from '@storybook/react';
import * as uuid from 'uuid';
import NetState from '../NetState';
import { GameMode, PlanetType } from '../world';
import { ThreeLayer } from '../ThreeLayers/ThreeLayer';
import { size } from '../coord';
import { Button } from '../HtmlLayers/ui/Button';
import {
  ReferencableIdBuilder,
  SandboxCommandBuilder,
} from '../../../world/pkg/world.extra';
import { delay } from '../utils/misc';

let nsRef: NetState | undefined;

const buildStory = async (): Promise<void> => {
  if (!nsRef) {
    return;
  }

  const star_ref_id = {
    tag: 'Reference' as const,
    reference: 'star',
  };

  nsRef.sendSandboxCmd(
    SandboxCommandBuilder.SandboxCommandSetupState({
      fields: {
        force_seed: 'Planets',
        star: {
          radius: 50.0,
          id: star_ref_id,
        },
        planets: [
          {
            p_type: PlanetType.Jovian,
            id: ReferencableIdBuilder.ReferencableIdId({
              id: '7d840590-01ce-4b37-a32a-037264da2e50',
            }),
            position: {
              x: 151.5383771371988,
              y: 15.99053448539727,
            },
            radius: 10.40783200434442,
            orbit_speed: 0.006703446259662917,
            anchor_id: star_ref_id,
            anchor_tier: 1,
          },
          {
            p_type: PlanetType.Jovian,
            id: ReferencableIdBuilder.ReferencableIdId({
              id: '236c0d02-0f3e-4b6a-b38c-f585c37d1fda',
            }),
            position: {
              x: 48.190782610927485,
              y: -346.1008470849561,
            },
            radius: 13.034404808418401,
            orbit_speed: 0.004853358999909491,
            anchor_id: star_ref_id,
            anchor_tier: 1,
          },
          {
            p_type: PlanetType.Jovian,
            id: ReferencableIdBuilder.ReferencableIdId({
              id: 'c9a20a37-01d0-4c04-a6cb-537858188225',
            }),
            position: {
              x: 271.90342161745934,
              y: 355.0107661147141,
            },
            radius: 14.284974612384675,
            orbit_speed: -0.004798295398229923,
            anchor_id: star_ref_id,
            anchor_tier: 1,
          },
          {
            p_type: PlanetType.Jovian,
            id: ReferencableIdBuilder.ReferencableIdId({
              id: '69ac2146-bd80-4662-a415-0ab29674e299',
            }),
            position: {
              x: 143.00871333645205,
              y: 43.567516371004665,
            },
            radius: 2.118708819446513,
            orbit_speed: 0.254957972235265,
            anchor_id: ReferencableIdBuilder.ReferencableIdId({
              id: '7d840590-01ce-4b37-a32a-037264da2e50',
            }),
            anchor_tier: 2,
          },
        ],
      },
    })
  );
  await delay(1000);
  nsRef.sendSandboxCmd(
    SandboxCommandBuilder.SandboxCommandTeleport({
      fields: {
        target: {
          x: 150,
          y: 0,
        },
      },
    })
  );
  await delay(100);
  nsRef.visualState.zoomShift = 0.8;
};

const startTestGame = async (): Promise<void> => {
  if (NetState.get()) {
    throw new Error('Double initialization');
  }
  const ns = NetState.make();
  await ns.init(GameMode.Sandbox);
  nsRef = ns;
  await buildStory();
};

const stopTestGame = async (): Promise<void> => {
  if (nsRef) {
    nsRef.disconnectAndDestroy();
  }
};

const Template: Story = (args) => {
  const [revision, setRevision] = useState(uuid.v4());
  const [playing, setPlaying] = useState(false);
  useEffect(() => {
    setRevision((old) => old + 1);
  }, []);
  size.width_px = 768;
  size.height_px = 768;

  useEffect(() => {
    return () => {
      // always destroy on unmount
      stopTestGame().then(() =>
        console.log('disconnect on unmount story done')
      );
    };
  }, []);

  const flipPlaying = useCallback(async () => {
    const newPlaying = !playing;
    if (newPlaying) {
      await startTestGame();
    } else {
      await stopTestGame();
    }
    setPlaying(newPlaying);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    flipPlaying().then();
  }, [flipPlaying]);

  return (
    <div
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}
    >
      <div style={{ width: 768, height: 768, position: 'relative' }}>
        {playing && (
          <ThreeLayer
            cameraMinZoomShiftOverride={0.1}
            cameraMaxZoomShiftOverride={10.0}
            desiredMode={GameMode.Sandbox}
            visible
          />
        )}
      </div>
      <Button thin onClick={flipPlaying} text="toggle playing" />
    </div>
  );
};

export const Main = Template.bind({});
Main.args = {};

export default {
  title: 'Functional/Planets',
  argTypes: {},
} as Meta;
