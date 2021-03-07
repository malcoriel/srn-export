/* eslint-disable react-hooks/rules-of-hooks */
import './ControlPanel.scss';
import React from 'react';
import {
  AiOutlineSolution,
  BsFillChatDotsFill,
  CgScreen,
  FaBullseye,
  FaQuestion,
  FiBox,
} from 'react-icons/all';
import { StyledRect } from './ui/StyledRect';
import { Button } from './ui/Button';
import { useStore } from '../store';
import NetState, {
  findMyPlayer,
  findMyShip,
  useNSForceChange,
} from '../NetState';
import { makePortraitPath } from './StartMenu';
import { Ship } from '../world';

const BUTTON_SIZE = 53;
const BUTTON_COUNT = 7;
const THICKNESS = 9;

const HpDisplay = ({ myShip }: { myShip: Ship }) => {
  return (
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
  );
};

const MoneyAndHp = () => {
  useNSForceChange('MoneyAndHp');
  const ns = NetState.get();
  if (!ns) {
    return null;
  }
  const myPlayer = findMyPlayer(ns.state);
  const myShip = findMyShip(ns.state);
  if (!myPlayer || !myShip) {
    return null;
  }
  return (
    <div className="money-and-hp">
      {myPlayer && (
        <StyledRect
          line="thin"
          thickness={4}
          contentClassName="money"
          halfThick
          noLeft
          noBottom
          width={100}
          height={22}
        >
          <span className="money-icon" />
          <span className="text">{myPlayer.money} SB</span>
        </StyledRect>
      )}
      <HpDisplay myShip={myShip} />
    </div>
  );
};

export const ControlPanel = () => {
  const setMenu = useStore((state) => state.setMenu);
  const toggleQuestWindow = useStore((state) => state.toggleQuestWindow);
  const toggleHelpWindow = useStore((state) => state.toggleHelpWindow);
  const toggleChatWindow = useStore((state) => state.toggleChatWindow);
  const toggleInventoryWindow = useStore(
    (state) => state.toggleInventoryWindow
  );
  const toggleLeaderboardWindow = useStore(
    (state) => state.toggleLeaderboardWindow
  );
  const myPlayerPortraitName = useStore((state) => state.portrait);

  // const myPlayer = findMyPlayer(ns.state);

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
            src={makePortraitPath(myPlayerPortraitName || 'question')}
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
        <Button onClick={toggleInventoryWindow}>
          <FiBox />
        </Button>
      </StyledRect>
      <MoneyAndHp />
    </div>
  );
};
