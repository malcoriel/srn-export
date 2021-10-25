import React, { useEffect } from 'react';
import { useNSForceChange } from './NetState';
import { useStore } from './store';
import { getSpecifierId } from './world';

export const StateStoreSyncer: React.FC = () => {
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
    const myShipHostileAutofocus = indexes.myShip?.hostile_auto_focus;
    if (
      getSpecifierId(myShipAutofocus) !== getSpecifierId(autoFocusSpecifier)
    ) {
      setAutoFocusSpecifier(myShipAutofocus);
    }
    if (
      getSpecifierId(myShipHostileAutofocus) !==
      getSpecifierId(hostileAutoFocusSpecifier)
    ) {
      setHostileAutoFocusSpecifier(myShipAutofocus);
    }
  });

  return null;
};
