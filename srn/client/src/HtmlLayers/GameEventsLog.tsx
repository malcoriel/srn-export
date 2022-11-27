import React, { useMemo, useState } from 'react';
import { useNSForceChange } from '../NetStateHooks';
import { Label } from './ui/Label';
import { WithScrollbars } from './ui/WithScrollbars';
import { Checkbox } from './ui/Checkbox';
import _ from 'lodash';
import ReactJson from 'react-json-view';
export const GameEventsLog = () => {
  const ns = useNSForceChange('GameEventsLog', false, (prev, next) => {
    return (
      prev.processed_events.length !== next.processed_events.length ||
      JSON.stringify(prev.processed_events[0]) !==
        JSON.stringify(next.processed_events[0])
    );
  });
  if (!ns) {
    return null;
  }

  const [showAll, setShowAll] = useState(false);

  const messages = ns.state.processed_events
    // cloning is necessary to avoid accidental modification of the state
    .map((e) => _.cloneDeep(e))
    .filter((e) => showAll || !!e.text_representation)
    .map((e) => {
      if (!e.text_representation) {
        const name = e.event.tag;
        delete e.event.tag;
        return {
          json_representation: (
            <ReactJson
              style={{
                display: 'flex',
                padding: 2,
                flexDirection: 'column',
                justifyContent: 'center',
              }}
              name={name}
              src={e.event}
              theme="apathy"
              enableClipboard={false}
              collapsed
            />
          ),
        };
      }
      return e;
    });

  return (
    <div className="chat">
      <div className="chat-container">
        <div style={{ marginBottom: 5 }}>
          <Label>Show all events:&nbsp;</Label>
          <Checkbox size={16} value={showAll} onChange={setShowAll} />
        </div>
        <WithScrollbars>
          <div className="chat-contents">
            {messages.map((m: any, i: number) => (
              <div className="line" key={i}>
                {m.text_representation
                  ? m.text_representation
                  : m.json_representation}
              </div>
            ))}
          </div>
        </WithScrollbars>
      </div>
    </div>
  );
};
