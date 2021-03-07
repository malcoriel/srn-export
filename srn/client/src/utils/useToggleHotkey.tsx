import { useState } from 'react';
import { useHotkeys } from 'react-hotkeys-hook';

export const hotkeyRegistry: Record<string, string> = {};

export const useToggleHotkey = (
  hotkey: string,
  defaultValue: boolean,
  description?: string,
  onSetShown?: (val: boolean) => void
): [boolean, (val: boolean) => void] => {
  if (description) hotkeyRegistry[hotkey] = description;
  const [shown, setShown] = useState(defaultValue);
  useHotkeys(
    hotkey,
    () => {
      const newVal = !shown;
      setShown(newVal);
      if (onSetShown) {
        onSetShown(newVal);
      }
    },
    [shown, setShown]
  );
  return [shown, setShown];
};
