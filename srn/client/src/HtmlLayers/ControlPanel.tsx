import './ControlPanel.scss';
import React from 'react';
import {
  AiOutlineSolution,
  BsFillChatDotsFill,
  CgScreen,
  FaBullseye,
  FcMindMap,
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
import { findObjectById, getObjectPosition, Ship } from '../world';
import { NotificationPanel } from './NotifcationPanel';
import { NotificationAction } from '../../../world/pkg';
import { ActionsBar } from './ActionsBar';

const BUTTON_SIZE = 53;
const BUTTON_COUNT = 7;
const THICKNESS = 9;

const HpDisplay = ({ myShip }: { myShip: Ship }) => {
  return (
    <div className="hp-bar">
      <div className="content">
        <div className="prefix-text">Ship integrity:&nbsp;</div>
        <div className="text">
          {Math.floor(myShip.health.current)}/{Math.floor(myShip.health.max)}
        </div>
        <div
          className="filler"
          style={{
            width: `${(myShip.health.current / myShip.health.max) * 100}%`,
          }}
        />
      </div>
    </div>
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
  return (
    <div className="money-and-hp">
      {myPlayer && (
        <div className="money">
          <span className="money-icon" />
          <span className="text">{myPlayer.money} SB</span>
        </div>
      )}
      {myShip && <HpDisplay myShip={myShip} />}
    </div>
  );
};

const Notifications = () => {
  useNSForceChange('MoneyAndHp');
  const ns = NetState.get();
  if (!ns) {
    return null;
  }
  const myPlayer = findMyPlayer(ns.state);
  if (!myPlayer) {
    return null;
  }
  return (
    <div className="notification-panel-in-control-panel">
      <NotificationPanel
        notifications={myPlayer.notifications}
        onAction={(act: NotificationAction) => {
          if (ns) {
            ns.sendNotificationAction(act);
          }
        }}
        onFocusObject={(id: string) => {
          if (ns) {
            const objLoc = findObjectById(ns.state, id);
            if (objLoc) {
              if (objLoc.locIndex === 0) {
                const pos = getObjectPosition(objLoc.object);
                ns.visualState.cameraPosition = pos;
                ns.visualState.boundCameraMovement = false;
              } else {
                // the object is outside of the current location - currently not possible.
                // for now, do nothing, but ideally this should open the map
                // and focus the system with it, and this logic should be reusable
                // so it should be a separate util
              }
            }
          }
        }}
      />
    </div>
  );
};

export const ControlPanel = () => {
  const setMenu = useStore((state) => state.setMenu);
  const toggleQuestWindow = useStore((state) => state.toggleQuestWindow);
  const toggleChatWindow = useStore((state) => state.toggleChatWindow);
  const toggleMapWindow = useStore((state) => state.toggleMapWindow);
  const toggleInventoryWindow = useStore(
    (state) => state.toggleInventoryWindow
  );
  const toggleLeaderboardWindow = useStore(
    (state) => state.toggleLeaderboardWindow
  );
  const myPlayerPortraitName = useStore((state) => state.portrait);

  return (
    <div className="control-panel">
      <StyledRect
        contentClassName="system-actions"
        height={90}
        width={BUTTON_SIZE * BUTTON_COUNT + THICKNESS * 2}
        thickness={THICKNESS}
        line="thin"
        noLeft
        noBottom
      >
        <MoneyAndHp />
        <div className="rect">
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
          <Button onClick={toggleQuestWindow} hotkey="o">
            <FaBullseye />
          </Button>
          <Button onClick={toggleLeaderboardWindow} hotkey="l">
            <AiOutlineSolution />
          </Button>
          <Button onClick={toggleChatWindow} hotkey="v">
            <BsFillChatDotsFill />
          </Button>
          <Button onClick={toggleInventoryWindow} hotkey="i">
            <FiBox />
          </Button>
          <Button onClick={toggleMapWindow} hotkey="m">
            <FcMindMap />
          </Button>
        </div>
      </StyledRect>
      <ActionsBar
        className="control-panel-actions-bar"
        indexByNumbers
        actions={[
          {
            text: 'qq',
            action: () => console.log('qq'),
            hotkey: 'q',
          },
          {
            icon: <FaBullseye size={20} />,
            action: () => console.log('icon'),
            hotkey: 'i',
          },
          {
            text: 'ww',
            action: () => console.log('ww'),
            hotkey: 'w',
          },
        ]}
      />
      <Notifications />
    </div>
  );
};
