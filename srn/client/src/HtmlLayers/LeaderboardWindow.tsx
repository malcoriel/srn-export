import React, { useEffect } from 'react';
import NetState from '../NetState';
import { Window } from './ui/Window';
import './LeaderboardWindow.scss';
import { useStore, WindowState } from '../store';
import { FaTelegram } from 'react-icons/fa';
import { useNSForceChange } from '../NetStateHooks';

export const LeaderboardWindow: React.FC = () => {
  const ns = NetState.get();
  if (!ns) return null;

  const setLeaderboardWindow = useStore((state) => state.setLeaderboardWindow);
  useEffect(() => {
    const onGameStartEnd = (ev: any) => {
      if (ev.tag === 'GameEnded') {
        setLeaderboardWindow(WindowState.Shown);
      } else if (ev.tag === 'GameStarted') {
        setLeaderboardWindow(WindowState.Hidden);
      }
    };
    ns.on('gameEvent', onGameStartEnd);
    return () => {
      ns.off('gameEvent', onGameStartEnd);
    };
  }, [ns, ns.id, setLeaderboardWindow]);
  useNSForceChange('LeaderboardWindow', false, (prevState, nextState) => {
    return (
      JSON.stringify(prevState.leaderboard) !==
        JSON.stringify(nextState.leaderboard) ||
      JSON.stringify(prevState.game_over) !==
        JSON.stringify(nextState.game_over)
    );
  });

  const { leaderboard, paused, my_id, game_over } = ns.state;
  if (!leaderboard) {
    return null;
  }

  const place = leaderboard.rating.findIndex(([id]) => id === my_id) + 1;
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
        place ? (
          <div className="leaderboard-window-minimized">
            Your place: {place} of {totalPlaces}
          </div>
        ) : null
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
      {paused && game_over && (
        <div className="game-over">
          <div className="game-over-text">Game over:</div>
          <div className="game-over-text game-over-reason">
            {game_over.reason}
          </div>
        </div>
      )}
      {paused && !game_over && (
        <div className="winner">Winner:{leaderboard.winner}</div>
      )}
      <div className="header">Leaderboard:</div>
      {leaderboard.rating.map(
        ([id, score, name]: [string, number, string], i: number) => (
          <div className="line" key={i}>
            {i + 1}.{name}&nbsp;:&nbsp;{score}
          </div>
        )
      )}
    </Window>
  );
};
