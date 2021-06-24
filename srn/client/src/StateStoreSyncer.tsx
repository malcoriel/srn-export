import React from 'react';
import { useNSForceChange } from './NetState';
import { useStore } from './store';
import { getSpecifierId } from './world';

export const StateStoreSyncer: React.FC = () => {
  const { autoFocusSpecifier, setAutoFocusSpecifier } = useStore((state) => ({
    autoFocusSpecifier: state.autoFocusSpecifier,
    setAutoFocusSpecifier: state.setAutoFocusSpecifier,
  }));
  const ns = useNSForceChange('StateStoreSyncer', true);
  if (!ns) {
    return null;
  }

  const { indexes } = ns;
  const myShipAutofocus = indexes.myShip?.auto_focus;
  if (getSpecifierId(myShipAutofocus) !== getSpecifierId(autoFocusSpecifier)) {
    console.log('focus change');
    setAutoFocusSpecifier(myShipAutofocus);
  }

  return null;
};
