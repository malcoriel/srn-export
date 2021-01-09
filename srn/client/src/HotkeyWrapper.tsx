import React from 'react';
import { useHotkeys } from 'react-hotkeys-hook';

export const HotkeyWrapper: React.FC<{
  hotkey: string;
  onPress: () => void;
}> = ({ hotkey, onPress }) => {
  useHotkeys(hotkey, onPress);
  return null;
};
