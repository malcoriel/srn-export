/* eslint-disable react-hooks/rules-of-hooks */
import './ControlPanel.scss';
import React from 'react';
import { StyledRect } from './ui/StyledRect';
import { Button } from './ui/Button';
import {
  AiOutlineSolution, BsFillChatDotsFill,
  CgScreen,
  FaBullseye,
  FaQuestion,
} from 'react-icons/all';
import { useStore } from '../store';
import NetState, {
  findMyPlayer,
  findMyShip,
  useNSForceChange,
} from '../NetState';
import { makePortraitPath } from './StartMenu';

const BUTTON_SIZE = 53;
const BUTTON_COUNT = 6;
const THICKNESS = 9;

export function ControlPanel() {
  const ns = NetState.get();
  if (!ns) return null;

  useNSForceChange('ControlPanel');
  const setMenu = useStore((state) => state.setMenu);
  const toggleQuestWindow = useStore((state) => state.toggleQuestWindow);
  const toggleHelpWindow = useStore((state) => state.toggleHelpWindow);
  const toggleChatWindow = useStore((state) => state.toggleChatWindow);
  const toggleLeaderboardWindow = useStore(
    (state) => state.toggleLeaderboardWindow
  );

  const myShip = findMyShip(ns.state);
  const myPlayer = findMyPlayer(ns.state);

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
        <Button>
          <img
            className="portrait"
            src={makePortraitPath(
              myPlayer ? myPlayer.portrait_name : 'question'
            )}
            alt="p"
          />
        </Button>
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
        <Button onClick={toggleChatWindow}>
          <BsFillChatDotsFill />
        </Button>
      </StyledRect>
      <div className="money-and-hp">
        {myPlayer && (
          <StyledRect
            line="thin"
            thickness={4}
            contentClassName={'money'}
            halfThick
            noLeft
            noBottom
            width={100}
            height={22}
          >
            <span className="money-icon" />
            <span className="text">{myPlayer.money}</span>
          </StyledRect>
        )}
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
            <div
              className="filler"
              style={{ width: `${(myShip.hp / myShip.max_hp) * 100}%` }}
            />
          </StyledRect>
        )}
      </div>
    </div>
  );
}
