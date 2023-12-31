import './ControlPanel.scss';
import React from 'react';
import { AiOutlineSolution } from 'react-icons/ai';
import { BsFillChatDotsFill } from 'react-icons/bs';
import { CgScreen } from 'react-icons/cg';
import { FaBullseye } from 'react-icons/fa';
import { FcMindMap } from 'react-icons/fc';
import { FiBox } from 'react-icons/fi';
import { StyledRect } from './ui/StyledRect';
import { Button } from './ui/Button';
import { useStore } from '../store';
import { makePortraitPath } from './StartMenu';
import { Ship } from '../world';
import { NotificationPanel } from './NotificationPanel';
import { GameState, NotificationActionR } from '../../../world/pkg';
import { PlayerActionsBar } from './PlayerActionsBar';
import {
  findMyPlayer,
  findMyShip,
  findObjectById,
  getObjectPosition,
} from '../ClientStateIndexing';
import { useNSForceChange } from '../NetStateHooks';

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

function shouldUpdateByHealth(prev: GameState, next: GameState) {
  const myShipOld = findMyShip(prev);
  const myShipNew = findMyShip(next);
  if (myShipOld && !myShipNew) {
    return true;
  }
  if (!myShipOld && myShipNew) {
    return true;
  }
  if (!myShipOld && !myShipNew) {
    return false;
  }
  if (myShipOld && myShipNew) {
    return myShipOld.health.current !== myShipNew.health.current;
  }
  return false;
}

function shouldUpdateByMoney(prev: GameState, next: GameState): boolean {
  const myPlayerPrev = findMyPlayer(prev);
  const myPlayerNext = findMyPlayer(next);
  if (myPlayerPrev && myPlayerNext) {
    return myPlayerPrev.money !== myPlayerNext.money;
  }
  if (!myPlayerPrev && !myPlayerNext) {
    return false;
  }
  return true;
}

const MoneyAndHp = () => {
  const ns = useNSForceChange('MoneyAndHp', false, (prev, next) => {
    return shouldUpdateByHealth(prev, next) || shouldUpdateByMoney(prev, next);
  });
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
  const ns = useNSForceChange('Notifications', false, (prev, next) => {
    const myPlayerPrev = findMyPlayer(prev);
    const myPlayerNext = findMyPlayer(next);
    return (
      JSON.stringify(myPlayerPrev?.notifications) !==
      JSON.stringify(myPlayerNext?.notifications)
    );
  });
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
        onAction={(act: NotificationActionR) => {
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
      <PlayerActionsBar />
      <Notifications />
    </div>
  );
};
