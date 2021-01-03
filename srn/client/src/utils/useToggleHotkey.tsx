import { useState } from 'react';
import { useHotkeys } from 'react-hotkeys-hook';

export const hotkeyRegistry: Record<string, string> = {};

export const useToggleHotkey = (
  hotkey: string,
  defaultValue: boolean,
  description?: string
): [boolean, (val: boolean) => void] => {
  if (description) hotkeyRegistry[hotkey] = description;
  const [shown, setShown] = useState(defaultValue);
  useHotkeys(
    hotkey,
    () => {
      setShown(!shown);
    },
    [shown, setShown]
  );
  return [shown, setShown];
};
