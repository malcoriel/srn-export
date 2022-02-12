import React, { useState } from 'react';
import { api } from '../utils/api';
import { Button } from './ui/Button';

export const ReplaysListMenu: React.FC<{
  startWatch: (replayId: string) => void;
  back: () => void;
}> = ({ back, startWatch }) => {
  const replays = api.useSavedReplays();

  return (
    <div className="play-menu">
      {replays.map((r: any) => (
        <Button
          thin
          key={r.id}
          text={r.name}
          onClick={() => {
            startWatch(r.id);
          }}
        />
      ))}
      <Button thin className="play" onClick={back} hotkey="b" text="BACK" />
    </div>
  );
};

export const WatchMenu: React.FC<{
  hide: () => void;
  startWatch: (replayId: string) => void;
}> = ({ hide, startWatch }) => {
  const [replaysList, setReplaysList] = useState(false);
  const replaysOrWatch = (
    <>
      {replaysList ? (
        <ReplaysListMenu
          startWatch={startWatch}
          back={() => setReplaysList(false)}
        />
      ) : (
        <>
          <div>Watch a recorded game saved on server</div>

          <Button
            className="play"
            onClick={() => {
              setReplaysList(true);
            }}
            hotkey="r"
            text="REPLAY"
          />
          <div>Or you can just go to the main menu:</div>
          <Button className="play" onClick={hide} hotkey="b" text="BACK" />
        </>
      )}
    </>
  );
  return <div className="play-menu">{replaysOrWatch}</div>;
};
