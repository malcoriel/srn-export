import React, { useEffect, useState } from 'react';
import { Meta, Story } from '@storybook/react';
import * as uuid from 'uuid';
import NetState from '../NetState';
import { GameMode, PlanetType } from '../world';
import { ThreeLayer } from '../ThreeLayers/ThreeLayer';
import { size } from '../coord';
import { Button } from '../HtmlLayers/ui/Button';
import { SandboxCommandBuilder } from '../../../world/pkg/world.extra';

let nsRef: NetState | undefined;

const buildStory = async (): Promise<void> => {
  if (!nsRef) {
    return;
  }

  const star_ref_id = {
    tag: 'Reference',
    reference: 'star',
  };
  console.log('building story');
  nsRef.sendSandboxCmd(
    SandboxCommandBuilder.SandboxCommandSetupState({
      fields: {
        star: {
          radius: 50.0,
          id: star_ref_id,
        },
        planets: [
          {
            p_type: PlanetType.Jovian,
            orbit_speed: 0.001,
            radius: 10.0,
            anchor_id: star_ref_id,
          },
        ],
      },
    })
  );
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

  return (
    <div
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}
    >
      <div style={{ width: 768, height: 768, position: 'relative' }}>
        {playing && <ThreeLayer desiredMode={GameMode.Sandbox} visible />}
      </div>
      <Button
        thin
        onClick={async () => {
          const newPlaying = !playing;
          if (newPlaying) {
            await startTestGame();
          } else {
            await stopTestGame();
          }
          setPlaying(newPlaying);
        }}
        text="toggle playing"
      />
    </div>
  );
};

export const Main = Template.bind({});
Main.args = {};

export default {
  title: 'Functional/Planets',
  argTypes: {},
} as Meta;
