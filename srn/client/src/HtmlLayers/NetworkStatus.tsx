import React, { useEffect, useState } from 'react';
import { GameState, Planet } from '../world';
import NetState from '../NetState';
import { StyledRect } from './ui/StyledRect';
import './NetworkStatus.scss';
import { FaWaveSquare, GiSplitArrows, RiFilmFill } from 'react-icons/all';
import { Stat, statsHeap } from './Perf';
import _ from 'lodash';

export const findPlanet = (
  state: GameState,
  id: string
): Planet | undefined => {
  return state.planets.find((p) => p.id === id);
};

export const NetworkStatus: React.FC = () => {
  const ns = NetState.get();
  if (!ns) return null;
  const [, forceUpdateNetworkStatus] = useState(false);

  useEffect(() => {
    ns.on('network', () => {
      forceUpdateNetworkStatus((i) => !i);
    });
    // unfortunately, the slowchange provides the state diff but this
    // component does not use it
    ns.on(
      'slowchange',
      _.throttle(() => {
        forceUpdateNetworkStatus((i) => !i);
      }, 1000)
    );
  }, [ns.id]);
  const { connecting, ping, maxPing, desync } = ns;
  const fps = statsHeap[Stat.RealFPS];

  return (
    <StyledRect
      thickness={8}
      line="thin"
      noTop
      noLeft
      className="network-status"
      contentClassName="network-status-content"
      height={30}
      width={240}
    >
      <span className="fps" title="frames per second">
        {fps ? (
          <>
            <RiFilmFill />
            <span className="fps-text">
              &nbsp;
              {fps}
              fps
            </span>
          </>
        ) : null}
      </span>
      <span className="desync" title="desync between client and server">
        <GiSplitArrows />
        <span className="desync-text">
          &nbsp;
          {desync}
          ms
        </span>
      </span>
      {!connecting && (
        <span className="ping" title="ping (half trip sync time)">
          {ping ? (
            <>
              &nbsp;
              <FaWaveSquare />
              &nbsp;
              <span title="current">
                <span className="ping-text">{ping}</span>
              </span>
              {maxPing ? (
                <span title="max">
                  <span className="ping-text">/{maxPing}</span>
                </span>
              ) : null}
            </>
          ) : (
            <span className="connecting">Connecting...&nbsp;</span>
          )}
        </span>
      )}
    </StyledRect>
  );
};
