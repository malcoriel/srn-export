import { QuickMenu, testQuickMenuActions } from './QuickMenu';
import React from 'react';
import NetState, { useNSForceChange } from '../NetState';
import { GameMode } from '../world';

export const SandboxQuickMenu = () => {
  const ns = NetState.get();
  if (!ns) return null;
  const show = ns.state.mode === GameMode.Sandbox;
  useNSForceChange('SandboxQuickMenu', false, (oldState, newState) => {
    return oldState.mode !== newState.mode;
  });

  if (!show) return null;

  return <QuickMenu startActions={testQuickMenuActions} mainHotkey="g" />;
};
