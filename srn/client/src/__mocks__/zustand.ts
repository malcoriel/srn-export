// from https://github.com/pmndrs/zustand/wiki/Testing
// Without this mock, zustand state is shared between tests, which obviously makes them dirty
import { act } from 'react-dom/test-utils';
import { resetAllStores, createMaker } from './zustandMockTools';
import actualCreate from 'zustand';

// Reset all stores after each test run
afterEach(() => {
  // @ts-ignore
  const actFn = global.reactAct || act; // react will throw a fit if different acts are used. when testing three, a different renderer is used, so a different act fn too
  actFn(resetAllStores);
});

const create = createMaker(actualCreate);

export default create;
