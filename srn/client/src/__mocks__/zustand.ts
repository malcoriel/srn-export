// from https://github.com/pmndrs/zustand/wiki/Testing
// Without this mock, zustand state is shared between tests, which obviously makes them dirty
import { act } from 'react-dom/test-utils';
import { resetAllStores, createMaker } from './zustandMockTools';
import actualCreate from 'zustand';

// Reset all stores after each test run
afterEach(() => {
  act(resetAllStores);
});

const create = createMaker(actualCreate);

export default create;
