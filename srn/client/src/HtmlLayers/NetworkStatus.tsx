import React, { useEffect, useState } from 'react';
import { GameState, Planet } from '../world';
import NetState from '../NetState';
import { StyledRect } from './ui/StyledRect';
import './NetworkStatus.scss';
import { FaWaveSquare, RiFilmFill } from 'react-icons/all';
import { Stat, statsHeap } from './Perf';

export const findPlanet = (
  state: GameState,
  id: string
): Planet | undefined => {
  return state.planets.find((p) => p.id === id);
};

export const NetworkStatus: React.FC = () => {
  const ns = NetState.get();
  if (!ns) return null;
  const [, forceUpdateNetworkStatus] = useState(0);

  useEffect(() => {
    ns.on('network', () => {
      forceUpdateNetworkStatus((i) => i + 1);
    });
    ns.on('slowchange', () => {
      forceUpdateNetworkStatus((i) => i + 1);
    });
  }, [ns.id]);
  const { connecting, ping, maxPing } = ns;
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
      width={140}
    >
      <span className="fps">
        {fps ? (
          <>
            <RiFilmFill />
            &nbsp;
            {fps}
            &nbsp;
          </>
        ) : null}
      </span>
      {connecting && <span>Connecting...&nbsp;</span>}
      {!connecting && (
        <span className="ping">
          {ping ? (
            <>
              <FaWaveSquare /> &nbsp;{ping}
              {maxPing ? <span>/{maxPing}</span> : null}
            </>
          ) : null}
        </span>
      )}
    </StyledRect>
  );
};
