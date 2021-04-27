import { QuickMenu } from './ui/QuickMenu';
// @ts-ignore
import React, { useEffect, useState } from 'react';
import NetState, { useNSForceChange } from '../NetState';
import { ImFloppyDisk } from 'react-icons/all';
import { api } from '../utils/api';

export const NormalQuickMenu = () => {
  const ns = NetState.get();
  if (!ns) return null;
  useNSForceChange('NormalQuickMenu', false, (oldState, newState) => {
    return oldState.locations[0].id !== newState.locations[0].id;
  });

  const actions = [
    {
      text: 'Jump to another system',
      icon: <ImFloppyDisk />,
      list: true,
      children: [].map(([name, id]: [string, string]) => {
        return {
          text: `${name} (${id})`,
          handler: () => api.loadSavedState(ns.state.my_id, id),
        };
      }),
    },
  ];
  return <QuickMenu startActions={actions} mainHotkey="q" />;
};
