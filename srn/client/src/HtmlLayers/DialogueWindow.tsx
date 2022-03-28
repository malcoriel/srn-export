import React, { Suspense, useEffect, useMemo, useState } from 'react';
import './DialogueWindow.scss';
import { Canvas } from '@react-three/fiber';
import _ from 'lodash';
import { useHotkeys } from 'react-hotkeys-hook';
import classNames from 'classnames';
import { Window } from './ui/Window';
import {
  CAMERA_DEFAULT_ZOOM,
  CAMERA_HEIGHT,
} from '../ThreeLayers/CameraControls';
import NetState from '../NetState';
import { makePortraitPath } from './StartMenu';
import { buildDialogueFromState, Dialogue, DialogueElem } from '../world';
import { useStore, WindowState } from '../store';
import { WithScrollbars } from './ui/WithScrollbars';
import { Vector3 } from 'three';
import { ThreePlanetShape } from '../ThreeLayers/ThreePlanetShape';
import Vector from '../utils/Vector';
import { transformAllTextSubstitutions } from '../utils/substitutions';
import { useNSForceChange } from '../NetStateHooks';

export const DialogueElemView: React.FC<DialogueElem> = (dialogue) => (
  <span className="dialogue-option">
    {React.Children.toArray(
      transformAllTextSubstitutions(dialogue.text, dialogue.substitution)
    )}
  </span>
);

const renderHistory = (history: DialogueElem[]) => {
  return (
    <div className="history-contents">
      {history.map((hi, i) => (
        <div key={i} className={`history-item ${hi.is_option && 'option'}`}>
          <DialogueElemView {...hi} />
        </div>
      ))}
    </div>
  );
};

const renderContent = (
  dialogue: Dialogue,
  ns: NetState,
  history: DialogueElem[]
) => {
  return (
    <div className="dialogue">
      <div className="context-part">
        <div className="history">
          <WithScrollbars noAutoHide autoScrollDown paddedRight>
            {renderHistory(history)}
          </WithScrollbars>
        </div>
        <div className="scene">
          {dialogue.planet && (
            <Canvas
              style={{ width: 200, height: 200, backgroundColor: 'black' }}
              orthographic
              camera={{
                position: new Vector3(0, 0, CAMERA_HEIGHT),
                zoom: CAMERA_DEFAULT_ZOOM() * 0.8,
              }}
            >
              <Suspense fallback={<mesh />}>
                <ambientLight />
                <pointLight position={[10, 10, 10]} />
                <ThreePlanetShape
                  gid={dialogue.planet.id}
                  position={new Vector(0, 0)}
                  radius={dialogue.planet.radius}
                  visible
                  key={dialogue.planet.id}
                  color={dialogue.planet.color}
                  atmosphereColor={dialogue.planet.color}
                />
              </Suspense>
            </Canvas>
          )}
        </div>
        {dialogue.right_character !== 'question' && (
          <div
            className={classNames({
              'context-character': true,
              big: !dialogue.planet,
            })}
          >
            {/* eslint-disable-next-line jsx-a11y/alt-text */}
            <img src={makePortraitPath(dialogue.right_character)} />
          </div>
        )}
      </div>
      <div className="options">
        {dialogue.options.map((option, i) => (
          <div
            key={i}
            className="line"
            onClick={() => ns.sendDialogueOption(dialogue.id, option.id)}
          >
            {i + 1}
            .&nbsp;
            <DialogueElemView key={option.id} {...option} />
          </div>
        ))}
      </div>
      <div className="hint">
        Hint: you can use numbers row (1-9) on the keyboard to select options
      </div>
    </div>
  );
};

const renderMinimized = (
  dialogue: Dialogue,
  ns: NetState,
  history: DialogueElem[]
) => (
  <div className="contents">
    {/*<WithScrollbars>*/}
    {/*  <DialogueElemView {...dialogue.prompt} />*/}
    {/*</WithScrollbars>*/}
    <div className="history">
      <WithScrollbars noAutoHide autoScrollDown paddedRight>
        {renderHistory(history)}
      </WithScrollbars>
    </div>
    <div className="options">
      <WithScrollbars>
        {dialogue.options.map((option, i) => (
          <div
            key={i}
            className="line"
            onClick={() => ns.sendDialogueOption(dialogue.id, option.id)}
          >
            {i + 1}
            .&nbsp;
            <DialogueElemView key={option.id} {...option} />
          </div>
        ))}
      </WithScrollbars>
    </div>
  </div>
);

export const DialogueWindow: React.FC = () => {
  const ns = useNSForceChange('DialogueWindow');
  if (!ns) return null;

  const setDialogueWindowState = useStore((state) => state.setDialogueWindow);
  const [history, setHistory] = useState<DialogueElem[]>([]);
  const { dialogue_states } = ns.state;

  const myPlayerId = ns.state.my_id;
  // technically [0] of the states was intended to show the active dialogue, but this is not supported yet
  const [dialogue_id, dialogue_state]: [string, string] = (Object.entries(
    (dialogue_states[myPlayerId] || [])[1] || {}
  )[0] as [string, string]) || [null, null];

  useEffect(() => {
    if (dialogue_id) {
      setDialogueWindowState(WindowState.Shown);
    } else {
      setDialogueWindowState(WindowState.Hidden);
    }
  }, [dialogue_id, setDialogueWindowState]);

  const dialogue: null | Dialogue = useMemo(() => {
    if (!dialogue_id || !dialogue_state) {
      return null;
    }
    return buildDialogueFromState(
      dialogue_id,
      dialogue_state,
      myPlayerId,
      ns.state
    );
    // deliberately ignore ns.state dependency as it only matters at the point of dialogue creation,
    // and shouldn't lead to recreation of the view every frame
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dialogue_id, dialogue_state]);

  const tryDoOption = (i: number) => () => {
    if (!dialogue) return;
    const options = dialogue.options;
    if (!options) return;
    if (options[i]) {
      setHistory([...history, options[i]]);
      ns.sendDialogueOption(dialogue.id, options[i].id);
    }
  };

  for (const i of _.times(9)) {
    useHotkeys(String(i + 1), tryDoOption(i), [tryDoOption, dialogue]);
  }

  useEffect(() => {
    if (dialogue) {
      setHistory([...history, dialogue.prompt]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dialogue]);

  if (!dialogue) {
    if (history.length) {
      setHistory([]);
    }
    return null;
  }

  return (
    <Window
      unclosable
      contentClassName="dialogue-window-content"
      height={616}
      width={622}
      line="thin"
      halfThick
      storeKey="dialogueWindow"
      thickness={8}
      minimizedClassname="minimized-dialogue"
      minimized={renderMinimized(dialogue, ns, history)}
    >
      {renderContent(dialogue, ns, history)}
    </Window>
  );
};
