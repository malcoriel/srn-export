import { useStore, WindowState } from '../store';
import React, { useState } from 'react';
import { Window } from './ui/Window';
import { Input } from './ui/Input';
import { Button } from './ui/Button';

export const PromptWindow: React.FC = () => {
  const [prompt, resolve, reject] = useStore(
    (state) => state.promptWindowParams
  );
  const setPromptWindow = useStore((state) => state.setPromptWindow);

  const [value, setValue] = useState('');
  const confirm = () => {
    resolve(value);
    setValue('');
    setPromptWindow(WindowState.Hidden);
  };

  const cancel = () => {
    setPromptWindow(WindowState.Hidden);
    setValue('');
    reject();
  };

  return (
    <Window
      width={200}
      height={200}
      unclosable
      storeKey="promptWindow"
      line="complex"
      thickness={8}
      halfThick
    >
      <span>{prompt}</span>
      <div
        onKeyDown={(ev: any) => {
          if (ev.code === 'Enter') {
            confirm();
          }
        }}
      >
        <Input
          autofocus
          noPropagation
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
      </div>
      <Button onClick={confirm}>Ok</Button>
      <Button onClick={cancel}>Cancel</Button>
    </Window>
  );
};
