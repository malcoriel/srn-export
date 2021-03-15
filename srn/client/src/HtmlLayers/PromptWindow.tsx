import { useStore, WindowState } from '../store';
import React, { useState } from 'react';
import { Window } from './ui/Window';
import { Input } from './ui/Input';
import { Button } from './ui/Button';
import './PromptWindow.scss';

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
      height={160}
      unclosable
      storeKey="promptWindow"
      line="complex"
      thickness={8}
      halfThick
      contentClassName="prompt-window-content"
    >
      <div className="prompt">{prompt}</div>
      <div
        className="input-container"
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
      <div className="buttons">
        <Button className="button" onClick={confirm}>
          Ok
        </Button>
        <Button className="button" onClick={cancel}>
          Cancel
        </Button>
      </div>
    </Window>
  );
};
export const usePrompt = (): ((prompt: string) => Promise<string>) => {
  const setPromptWindow = useStore((state) => state.setPromptWindow);
  const setPromptWindowParams = useStore(
    (state) => state.setPromptWindowParams
  );
  return async (prompt: string) => {
    return await new Promise((resolve, reject) => {
      setPromptWindow(WindowState.Shown);
      setPromptWindowParams(prompt, resolve, reject);
    });
  };
};
