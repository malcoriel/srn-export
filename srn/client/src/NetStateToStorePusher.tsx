import React, { useEffect } from 'react';
import { useStore } from './store';
import { getSpecifierId } from './world';
import { useNSForceChange } from './NetStateHooks';

// this is a connection between zustand's store that controls the Srn component / global React app state,
// and the NetState, which controls the true game state, primarily for the sake of various UI purposes getting immdediately reflected
// strictly speaking, it's not needed for components because they can simply use even subscription via useNSForceChange, but sometimes
// when binding is not direct and some other stuff neeeds to modify the store, it's better to sync through here
export const NetStateToStorePusher: React.FC = () => {
  const {
    autoFocusSpecifier,
    setAutoFocusSpecifier,
    hostileAutoFocusSpecifier,
    setHostileAutoFocusSpecifier,
  } = useStore((state) => ({
    autoFocusSpecifier: state.autoFocusSpecifier,
    setAutoFocusSpecifier: state.setAutoFocusSpecifier,
    hostileAutoFocusSpecifier: state.hostileAutoFocusSpecifier,
    setHostileAutoFocusSpecifier: state.setHostileAutoFocusSpecifier,
  }));
  const ns = useNSForceChange('StateStoreSyncer', true);
  if (!ns) {
    return null;
  }

  // intentionally always update, because it will only rerender on ns fast change
  useEffect(() => {
    const { indexes } = ns;
    const myShipAutofocus = indexes.myShip?.auto_focus;
    const currentAutofocus = getSpecifierId(myShipAutofocus);
    const oldAutofocus = getSpecifierId(autoFocusSpecifier);
    if (currentAutofocus !== oldAutofocus) {
      setAutoFocusSpecifier(myShipAutofocus);
    }

    const myShipHostileAutofocus = indexes.myShip?.hostile_auto_focus;
    const currentHostileAutofocus = getSpecifierId(myShipHostileAutofocus);
    const oldHostileAutofocus = getSpecifierId(hostileAutoFocusSpecifier);
    if (currentHostileAutofocus !== oldHostileAutofocus) {
      setHostileAutoFocusSpecifier(myShipHostileAutofocus);
    }
  });

  return null;
};
