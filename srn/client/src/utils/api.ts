import { GameMode } from '../../../world/pkg/world.extra';
import { RoomIdResponse } from '../../../world/pkg/world';
import useSWR, { mutate } from 'swr';

const patchParams = (url: string, params: Record<string, string>) => {
  let res = url;
  for (const [key, value] of Object.entries(params)) {
    res = res.replace(`<${key}>`, value);
  }
  return res;
};

const apiUrl =
  process.env.NODE_ENV !== 'production'
    ? 'http://localhost:8000/api'
    : 'https://srn.malcoriel.de/api';
export const api = {
  getVersion: async () => {
    const resp = await fetch(`${apiUrl}/version`);
    return await resp.json();
  },
  useSavedStates: () =>
    useSWR(`${api.getSandboxApiUrl()}/saved_states`).data || [],
  saveSavedState: async (player_id: string, name: string) => {
    const resp = await fetch(
      patchParams(
        `${api.getSandboxApiUrl()}/saved_states/save_current/<player_id>/<name>`,
        {
          player_id,
          name,
        }
      ),
      { method: 'POST' }
    );
    await mutate(`${api.getSandboxApiUrl()}/saved_states`);
    return resp;
  },
  loadSavedState: async (player_id: string, state_id: string) => {
    await fetch(
      patchParams(
        `${api.getSandboxApiUrl()}/saved_states/load/<player_id>/<state_id>`,
        {
          player_id,
          state_id,
        }
      ),
      { method: 'POST' }
    );
  },
  downloadStateAsJson: async (player_id: string): Promise<unknown> => {
    const res = await fetch(
      patchParams(`${api.getSandboxApiUrl()}/saved_states/json/<player_id>`, {
        player_id,
      })
    );
    return await res.json();
  },
  loadRandomState: async (player_id: string) => {
    await fetch(
      patchParams(
        `${api.getSandboxApiUrl()}/saved_states/load_random/<player_id>`,
        {
          player_id,
        }
      ),
      { method: 'POST' }
    );
  },

  createRoom: async (mode: string): Promise<string> => {
    const res = await fetch(
      patchParams(`${api.getRoomsApiUrl()}/create/<mode>`, {
        mode,
      }),
      { method: 'POST' }
    );
    let rawResponse = await res.json();
    console.log('create room response', rawResponse);
    return (rawResponse as RoomIdResponse).room_id;
  },

  loadCleanState: async (player_id: string) => {
    await fetch(
      patchParams(
        `${api.getSandboxApiUrl()}/saved_states/load_clean/<player_id>`,
        {
          player_id,
        }
      ),
      { method: 'POST' }
    );
  },
  loadSeededState: async (player_id: string, seed: string) => {
    await fetch(
      patchParams(
        `${api.getSandboxApiUrl()}/saved_states/load_seeded/<player_id>/<seed>`,
        {
          player_id,
          seed,
        }
      ),
      { method: 'POST' }
    );
  },

  getWebSocketUrl() {
    return process.env.NODE_ENV === 'production'
      ? 'wss://srn.malcoriel.de/ws'
      : 'ws://localhost:2794';
  },

  getMainApiUrl() {
    return process.env.NODE_ENV === 'production'
      ? 'https://srn.malcoriel.de/api'
      : 'http://localhost:8000/api';
  },

  getSandboxApiUrl() {
    return `${api.getMainApiUrl()}/sandbox`;
  },

  getRoomsApiUrl() {
    return `${api.getMainApiUrl()}/rooms`;
  },

  getChatWebSocketUrl() {
    return process.env.NODE_ENV === 'production'
      ? 'wss://srn.malcoriel.de/ws-chat'
      : 'ws://localhost:2795';
  },
};
