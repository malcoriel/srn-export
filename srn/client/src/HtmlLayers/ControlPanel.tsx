import './ControlPanel.scss';
import React from 'react';
import { StyledRect } from './ui/StyledRect';
import { Button } from './ui/Button';
import {
  AiOutlineSolution,
  CgMenuBoxed,
  CgScreen,
  FaBullseye,
  FaQuestion,
  HiDesktopComputer,
} from 'react-icons/all';
import { useStore } from '../store';
import NetState, { findMyShip, useNSForceChange } from '../NetState';

const BUTTON_SIZE = 50;
const BUTTON_COUNT = 4;
const THICKNESS = 9;

export function ControlPanel() {
  const ns = NetState.get();
  if (!ns) return null;

  useNSForceChange('ControlPanel');
  const setMenu = useStore((state) => state.setMenu);
  const toggleQuestWindow = useStore((state) => state.toggleQuestWindow);
  const toggleHelpWindow = useStore((state) => state.toggleHelpWindow);
  const toggleLeaderboardWindow = useStore(
    (state) => state.toggleLeaderboardWindow
  );

  let myShip = findMyShip(ns.state);

  return (
    <div className="control-panel">
      <StyledRect
        contentClassName="rect"
        height={60}
        width={BUTTON_SIZE * BUTTON_COUNT + THICKNESS * 2}
        thickness={THICKNESS}
        line="thin"
        noLeft
        noBottom
      >
        <Button
          onClick={() => {
            setMenu(true);
          }}
        >
          <CgScreen />
        </Button>
        <Button onClick={toggleHelpWindow}>
          <FaQuestion />
        </Button>
        <Button onClick={toggleQuestWindow}>
          <FaBullseye />
        </Button>
        <Button onClick={toggleLeaderboardWindow}>
          <AiOutlineSolution />
        </Button>
      </StyledRect>
      {myShip && (
        <StyledRect
          height={20}
          width={200}
          line="thin"
          thickness={4}
          halfThick
          noLeft
          noBottom
          className="hp-bar"
        >
          <div className="text">
            {Math.floor(myShip.hp)}/{Math.floor(myShip.max_hp)}
          </div>
          <div className="filler" />
        </StyledRect>
      )}
    </div>
  );
}
