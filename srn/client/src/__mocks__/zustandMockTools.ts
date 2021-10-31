// a variable to hold reset functions for all stores declared in the app
export const storeResetFns = new Set();

// when creating a store, we get its initial state, create a reset function and add it in the set
// it's impossible to import real zustand create here, so it has to be passed
export const createMaker = (actualCreate: any) => (createState: any) => {
  const store = actualCreate(createState);
  const initialState = store.getState();
  storeResetFns.add(() => store.setState(initialState, true));
  return store;
};

export const resetAllStores = () =>
  storeResetFns.forEach((resetFn: any) => resetFn());
