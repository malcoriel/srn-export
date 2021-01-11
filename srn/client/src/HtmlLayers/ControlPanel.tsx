import './ControlPanel.scss';
import React from 'react';
import { StyledRect } from './ui/StyledRect';
import { Button } from './ui/Button';
import {
  AiOutlineSolution,
  CgMenuBoxed,
  FaBullseye,
  FaQuestion,
} from 'react-icons/all';
import { useStore } from '../store';

const BUTTON_SIZE = 50;
const BUTTON_COUNT = 4;
export function ControlPanel() {
  let THICKNESS = 9;
  const setMenu = useStore((state) => state.setMenu);
  const toggleQuestWindow = useStore((state) => state.toggleQuestWindow);
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
          <CgMenuBoxed />
        </Button>
        <Button>
          <FaQuestion />
        </Button>
        <Button onClick={toggleQuestWindow}>
          <FaBullseye />
        </Button>
        <Button>
          <AiOutlineSolution />
        </Button>
      </StyledRect>
    </div>
  );
}