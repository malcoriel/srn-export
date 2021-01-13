import React, { useEffect, useState } from 'react';
import { GameState, Planet } from '../world';
import NetState from '../NetState';
import { StyledRect } from './ui/StyledRect';
import './NetworkStatus.scss';
import { FaWaveSquare, GiSplitArrows, RiFilmFill } from 'react-icons/all';
import { Stat, statsHeap } from './Perf';
import useFitText from 'use-fit-text';

export const FitText: React.FC<{ className?: string }> = ({
  children,
  className,
}) => {
  const { fontSize, ref } = useFitText();
  return (
    <span className={className} ref={ref} style={{ fontSize }}>
      {children}
    </span>
  );
};

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
    ns.on('slowchange', () => {
      forceUpdateNetworkStatus((i) => !i);
    });
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
            <FitText className="fps-text">
              &nbsp;
              {fps}
              fps
            </FitText>
          </>
        ) : null}
      </span>
      <span className="desync" title="desync between client and server">
        <GiSplitArrows />
        <FitText className="desync-text">&nbsp;{desync}ms</FitText>
      </span>
      {!connecting && (
        <span className="ping">
          {ping ? (
            <>
              &nbsp;
              <FaWaveSquare />
              &nbsp;
              <span title="current ping (half trip sync time)">
                <FitText>{ping}</FitText>
              </span>
              {maxPing ? (
                <span title="max ping (half trip sync time)">
                  <FitText>/{maxPing}</FitText>
                </span>
              ) : null}
            </>
          ) : (
            <FitText className="connecting">Connecting...&nbsp;</FitText>
          )}
        </span>
      )}
    </StyledRect>
  );
};
