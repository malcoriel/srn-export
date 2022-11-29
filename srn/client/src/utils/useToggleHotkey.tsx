import { useCallback, useState } from 'react';
import { useHotkeys } from 'react-hotkeys-hook';
import { useStore } from '../store';

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
