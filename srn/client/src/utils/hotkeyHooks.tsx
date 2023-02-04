import { useCallback, useEffect, useState } from 'react';
import { useHotkeys, Options } from 'react-hotkeys-hook';
import { useStore } from '../store';
import { KeyHandler } from 'hotkeys-js';

export type HotkeyOptions = Options;
export const hotkeyRegistry: Record<string, string> = {};

export const useToggleHotkey = (
  hotkey: string,
  defaultValue: boolean,
  description?: string,
  onSetShown?: (val: boolean) => void,
  globalStoreKey = 'some'
): [boolean, (val: boolean) => void] => {
  if (description) hotkeyRegistry[hotkey] = description;
  // const globalState = useStore((store) => store.hotkeysPressed[globalStoreKey]);
  const setGlobalState = useStore((store) => store.setHotkeyPressed);
  const [shown, setShown] = useState(defaultValue);
  const syncedSetShown = useCallback(
    (value) => {
      setShown(value);
      setGlobalState(globalStoreKey, value);
    },
    [setShown, setGlobalState, globalStoreKey]
  );
  useEffect(() => {
    // sync once to ensure the global state value matches the default value from hook
    syncedSetShown(defaultValue);
  }, []);
  useHotkeys(
    hotkey,
    () => {
      const newVal = !shown;
      syncedSetShown(newVal);
      if (onSetShown) {
        onSetShown(newVal);
      }
    },
    [shown, onSetShown, syncedSetShown]
  );
  return [shown, syncedSetShown];
};

const inScope = (currentScope: string, targetScope: string): boolean => {
  if (targetScope === 'global') {
    return true;
  }
  return currentScope.startsWith(targetScope);
};

export const useScopedHotkey = (
  hotkey: string,
  onActivate: KeyHandler,
  scope: string,
  options: HotkeyOptions,
  deps: any[]
) => {
  const hotkeyScope = useStore((store) => store.hotkeyScope);
  useHotkeys(
    hotkey,
    onActivate,
    { ...options, enabled: inScope(hotkeyScope, scope) && options.enabled },
    deps
  );
};

export const useBoundHotkeyScope = (boundScope: string, shown: boolean) => {
  const setScope = useStore((store) => store.setHotkeyScope);
  useEffect(() => {
    if (shown) {
      setScope(boundScope);
    } else {
      setScope('game');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shown]);
};
