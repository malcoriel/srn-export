import useSWR from 'swr';

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
    useSWR(`${api.getHttpApiUrl()}/saved_states`).data || [],
  saveSavedState: async (player_id: string, name: string) => {
    const resp = await fetch(
      patchParams(
        `${api.getHttpApiUrl()}/saved_states/save_current/<player_id>/<name>`,
        {
          player_id,
          name,
        }
      ),
      { method: 'POST' }
    );
    return resp;
  },
  loadSavedState: async (player_id: string, state_id: string) => {
    const resp = await fetch(
      patchParams(
        `${api.getHttpApiUrl()}/saved_states/load/<player_id>/<state_id>`,
        {
          player_id,
          state_id,
        }
      ),
      { method: 'POST' }
    );
    return await resp.json();
  },

  getWebSocketUrl() {
    return process.env.NODE_ENV === 'production'
      ? 'wss://srn.malcoriel.de/ws'
      : 'ws://localhost:2794';
  },

  getHttpApiUrl() {
    return process.env.NODE_ENV === 'production'
      ? 'https://srn.malcoriel.de/api'
      : 'http://localhost:8000/api';
  },

  getChatWebSocketUrl() {
    return process.env.NODE_ENV === 'production'
      ? 'wss://srn.malcoriel.de/ws-chat'
      : 'ws://localhost:2795';
  },
};
