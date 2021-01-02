import { useState } from 'react';
import { useHotkeys } from 'react-hotkeys-hook';

export const useToggleHotkey = (hotkey: string, defaultValue: boolean) => {
  const [shown, setShown] = useState(defaultValue);
  useHotkeys(
    hotkey,
    () => {
      setShown(!shown);
    },
    [shown, setShown]
  );
  return shown;
};
