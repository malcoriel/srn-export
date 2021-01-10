const apiUrl =
  process.env.NODE_ENV !== 'production'
    ? 'http://localhost:8000/api'
    : 'https://srn.malcoriel.de/api';
export const api = {
  getVersion: async () => {
    try {
      const resp = await fetch(apiUrl + '/version');
      return await resp.json();
    } catch (e) {
      console.warn('error fetching version', e);
      throw e;
    }
  },
};
