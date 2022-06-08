import { delay } from '../utils/misc';
import { GameMode, genPeriod, PlanetType } from '../world';
import NetState from '../NetState';
import {
  ReferencableIdBuilder,
  SandboxCommandBuilder,
} from '../../../world/pkg/world.extra';
import { IVector } from '../utils/Vector';
import { SBSetupState } from '../../../world/pkg/world';

let nsRef: NetState | undefined;

export interface BuildStoryParams {
  initialState: SBSetupState;
  initialPos: IVector;
  initialZoom: number;
}

export const buildStory = async ({
  initialState,
  initialPos,
  initialZoom,
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
  nsRef.visualState.zoomShift = initialZoom;
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
