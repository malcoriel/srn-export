import React from 'react';
import { delay } from '../utils/misc';
import { GameMode } from '../world';
import NetState from '../NetState';
import { SandboxCommandBuilder } from '../../../world/pkg/world.extra';
import { IVector } from '../utils/Vector';
import { Action, SBSetupState } from '../../../world/pkg/world';
import { Story } from '@storybook/react';
import { useCallback, useEffect, useState } from 'react';
import * as uuid from 'uuid';
import { size } from '../coord';
import { ThreeLayer } from '../ThreeLayers/ThreeLayer';
import { CameraCoordinatesBox } from '../HtmlLayers/CameraCoordinatesBox';
import { Button } from '../HtmlLayers/ui/Button';
import { executeSyncAction } from '../utils/ShipControls';

let nsRef: NetState | undefined;

export interface BuildStoryParams {
  initialState: SBSetupState;
  initialPos: IVector;
  initialZoom: number;
  forceCameraPosition?: IVector;
  actions?: { wait: number; action: Action }[];
}

const patchAction = (action: Action, nsRef: NetState) => {
  if (!nsRef.indexes.myShip) {
    throw new Error(
      'cannot patch actions due to lack of myShip in state indexes'
    );
  }
  if (action.tag === 'Navigate') {
    if (action.ship_id === '$my_ship_id') {
      action.ship_id = nsRef.indexes.myShip.id;
    }
  }
};

export const buildStory = async ({
  initialState,
  initialPos,
  initialZoom,
  forceCameraPosition,
  actions,
}: BuildStoryParams): Promise<void> => {
  if (!nsRef) {
    return;
  }

  nsRef.sendSandboxCmd(
    SandboxCommandBuilder.SandboxCommandSetupState({ fields: initialState })
  );
  await delay(1000);

  nsRef.sendSandboxCmd(
    SandboxCommandBuilder.SandboxCommandTeleport({
      fields: {
        target: initialPos,
      },
    })
  );
  await delay(100);
  if (forceCameraPosition) {
    nsRef.visualState.boundCameraMovement = false;
    nsRef.visualState.cameraPosition = forceCameraPosition;
  }
  nsRef.visualState.zoomShift = initialZoom;
  if (actions) {
    for (const { action, wait } of actions) {
      await delay(wait);
      patchAction(action, nsRef);
      executeSyncAction(action);
    }
  }
};

export const startTestGame = async (
  params: BuildStoryParams
): Promise<void> => {
  if (NetState.get()) {
    throw new Error('Double initialization');
  }
  const ns = NetState.make();
  await ns.init(GameMode.Sandbox);
  nsRef = ns;
  await buildStory(params);
};

export const stopTestGame = async (): Promise<void> => {
  if (nsRef) {
    nsRef.disconnectAndDestroy();
  }
};
export const getStartGameParams: Record<string, () => BuildStoryParams> = {};

export const FunctionalStoryTemplate: Story = (args) => {
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

  const flipPlaying = useCallback(async (oldPlaying) => {
    const newPlaying = !oldPlaying;
    if (newPlaying) {
      await startTestGame(getStartGameParams[args.storyName]());
    } else {
      await stopTestGame();
    }
    setPlaying(newPlaying);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    flipPlaying(false).then();
  }, [flipPlaying]);

  return (
    <div
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}
    >
      <div style={{ width: 768, height: 768, position: 'relative' }}>
        {playing && (
          <div style={{ height: '100%', width: '100%' }}>
            <ThreeLayer
              cameraMinZoomShiftOverride={0.1}
              cameraMaxZoomShiftOverride={10.0}
              desiredMode={GameMode.Sandbox}
              visible
              defaultShowGrid
            />
            <CameraCoordinatesBox />
          </div>
        )}
      </div>
      <Button
        thin
        onClick={() => {
          flipPlaying(playing).then();
        }}
        text="toggle playing"
      />
    </div>
  );
};