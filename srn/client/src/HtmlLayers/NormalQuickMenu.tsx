import { QuickMenu } from './ui/QuickMenu';
// @ts-ignore
import React, { useEffect, useState } from 'react';
import NetState, { useNSForceChange } from '../NetState';
import { ImFloppyDisk } from 'react-icons/all';

export const NormalQuickMenu = () => {
  const ns = NetState.get();
  if (!ns) return null;
  useNSForceChange('NormalQuickMenu', false, (oldState, newState) => {
    return oldState.locations[0].id !== newState.locations[0].id;
  });

  const currentLocation = ns.state.locations[0];
  if (!currentLocation) {
    return null;
  }

  const actions = [
    {
      text: 'Jump to another system',
      icon: <ImFloppyDisk />,
      list: true,
      children: currentLocation.adjacent_location_ids.map((id: string) => {
        return {
          text: `${id}`,
          handler: () => ns.sendLocationChange(id),
        };
      }),
    },
  ];
  return <QuickMenu startActions={actions} mainHotkey="e" />;
};
