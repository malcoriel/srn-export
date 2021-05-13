import React from 'react';
import { Button } from '../HtmlLayers/ui/Button';
import './TestUI.scss';
import { TestMenuMode, useStore } from '../store';
import { UnreachableCaseError } from 'ts-essentials';
import { PlanetTestUI } from './PlanetTestUI';

export const TestMenu = () => {
  const testMenuMode = useStore((state) => state.testMenuMode);
  const setTestMenuMode = useStore((state) => state.setTestMenuMode);
  const toggleButton = (
    <>
      <Button
        className="hidden-button"
        hotkey="alt+t"
        text="toggle test tools"
        onClick={() => {
          const old = testMenuMode;
          let newMode = old;
          if (old === TestMenuMode.Hidden) {
            newMode = TestMenuMode.Shown;
          }
          if (old === TestMenuMode.Shown) {
            newMode = TestMenuMode.Hidden;
          }

          setTestMenuMode(newMode);
        }}
      />
    </>
  );
  return testMenuMode === TestMenuMode.Shown ? (
    <div className="test-menu">
      <div>Test tools</div>
      <Button
        hotkey="p"
        text="Planet test"
        onClick={() => setTestMenuMode(TestMenuMode.PlanetTest)}
      />
      {toggleButton}
    </div>
  ) : (
    toggleButton
  );
};

export const TestUI = () => {
  const testMenuMode = useStore((state) => state.testMenuMode);
  switch (testMenuMode) {
    case TestMenuMode.Hidden:
      return null;
    case TestMenuMode.Shown:
      return null;
    case TestMenuMode.PlanetTest:
      return <PlanetTestUI />;
    default:
      throw new UnreachableCaseError(testMenuMode);
  }
};
