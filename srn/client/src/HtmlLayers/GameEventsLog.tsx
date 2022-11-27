import React from 'react';
import { useNSForceChange } from '../NetStateHooks';
import { WithScrollbars } from './ui/WithScrollbars';
export const GameEventsLog = () => {
  const ns = useNSForceChange('GameEventsLog');
  if (!ns) {
    return null;
  }
  const messages = ns.state.processed_events.filter(
    (e) => !!e.text_representation
  );
  return (
    <div className="chat">
      <div className="chat-container">
        <WithScrollbars>
          <div className="chat-contents">
            {messages.map((m: any, i: number) => (
              <div className="line" key={i}>
                {m.text_representation}
              </div>
            ))}
          </div>
        </WithScrollbars>
      </div>
    </div>
  );
};
