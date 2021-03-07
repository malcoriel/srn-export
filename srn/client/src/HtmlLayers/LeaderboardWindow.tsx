/* eslint-disable react-hooks/rules-of-hooks */
import React, { useEffect } from 'react';
import NetState, { useNSForceChange } from '../NetState';
import { Window } from './ui/Window';
import './LeaderboardWindow.scss';
import { useStore, WindowState } from '../store';
import { FaTelegram } from 'react-icons/fa';

export const LeaderboardWindow: React.FC = () => {
  const ns = NetState.get();
  if (!ns) return null;

  const setLeaderboardWindow = useStore((state) => state.setLeaderboardWindow);
  useEffect(() => {
    let onGameStartEnd = (ev: any) => {
      if (ev === 'GameEnded') {
        setLeaderboardWindow(WindowState.Shown);
      } else if (ev === 'GameStarted') {
        setLeaderboardWindow(WindowState.Minimized);
      }
    };
    ns.on('gameEvent', onGameStartEnd);
    return () => {
      ns.off('gameEvent', onGameStartEnd);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ns.id]);
  useNSForceChange('LeaderboardWindow', false, (prevState, nextState) => {
    return (
      JSON.stringify(prevState.leaderboard) !==
      JSON.stringify(nextState.leaderboard)
    );
  });

  const { leaderboard, milliseconds_remaining, paused, my_id } = ns.state;
  if (!leaderboard) {
    return null;
  }

  const place = leaderboard.rating.findIndex(([p]) => p.id === my_id) + 1;
  const totalPlaces = leaderboard.rating.length;

  return (
    <Window
      width={250}
      height={400}
      thickness={8}
      line="thick"
      storeKey="leaderboardWindow"
      className="leaderboard-window"
      contentClassName="leaderboard-window-content"
      minimized={
        place && (
          <div className="leaderboard-window-minimized">
            Your place: {place} of {totalPlaces}
          </div>
        )
      }
    >
      <div className="news-talk">
        Subscribe to{' '}
        <a
          href="https://t.me/joinchat/WLDnjKtHTPplQZje"
          rel="noreferrer"
          target="_blank"
        >
          <FaTelegram />
          &nbsp; news & talk
        </a>
      </div>
      {paused && <div className="winner">Winner: {leaderboard.winner}</div>}
      <div className="header">Leaderboard:</div>
      {leaderboard.rating.map(([p, s], i) => (
        <div className="line" key={p.id}>
          {i + 1}. {p.name} - {s}
        </div>
      ))}
      ,
    </Window>
  );
};
