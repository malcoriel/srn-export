import React, { ReactNode, useEffect, useState } from 'react';
import './DialogueWindow.scss';
import { Canvas } from 'react-three-fiber';
import { Vector3 } from 'three';
import _ from 'lodash';
import { useHotkeys } from 'react-hotkeys-hook';
import classNames from 'classnames';
import { Window } from './ui/Window';
import {
  CAMERA_DEFAULT_ZOOM,
  CAMERA_HEIGHT,
} from '../ThreeLayers/CameraControls';
import { ThreePlanetShape } from '../ThreeLayers/ThreePlanetShape';
import NetState from '../NetState';
import { makePortraitPath } from './StartMenu';
import {
  Dialogue,
  DialogueElem,
  DialogueSubstitution,
  DialogueSubstitutionType,
  Planet,
} from '../world';
import { useStore, WindowState } from '../store';
import { findPlanet } from './NetworkStatus';
import { WithScrollbars } from './ui/WithScrollbars';

export const DialogueElemView: React.FC<DialogueElem> = (dialogue) => (
  <span className="dialogue-option">
    {substituteText(dialogue.text, dialogue.substitution)}
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
) => (
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
              zoom: CAMERA_DEFAULT_ZOOM() * 0.4,
            }}
          >
            <ambientLight />
            <pointLight position={[10, 10, 10]} />
            <ThreePlanetShape
              visible
              key={dialogue.planet.id}
              scale={
                _.times(3, () => dialogue.planet!.radius) as [
                  number,
                  number,
                  number
                ]
              }
              color={dialogue.planet.color}
            />
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
  const ns = NetState.get();
  if (!ns) return null;

  const [, forceUpdate] = useState(false);
  const dialogueWindowState = useStore((state) => state.dialogueWindow);
  const setDialogueWindowState = useStore((state) => state.setDialogueWindow);
  const [history, setHistory] = useState<DialogueElem[]>([]);
  useEffect(() => {
    const onDialogueChange = () => {
      if (dialogueWindowState === WindowState.Hidden) {
        setDialogueWindowState(WindowState.Shown);
      }
      forceUpdate((old) => !old);
    };
    ns.on('dialogue', onDialogueChange);
    return () => {
      ns.off('dialogue', onDialogueChange);
    };
  }, [ns.id, dialogueWindowState, setDialogueWindowState]);

  const { dialogue } = ns;

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
export const enrichSub = (s: DialogueSubstitution): ReactNode => {
  const ns = NetState.get();
  if (!ns) return null;

  const { visualState } = ns;

  const focus = (p: Planet) => {
    visualState.cameraPosition = { x: p.x, y: p.y };
    visualState.boundCameraMovement = false;
  };

  switch (s.s_type) {
    case DialogueSubstitutionType.PlanetName:
      const planet = findPlanet(ns.state, s.id);
      if (!planet) {
        console.warn(`substitution planet not found by id ${s.id}`);
        return <span className="sub-planet">{s.text}</span>;
      }
      return (
        <span className="sub-planet found" onClick={() => focus(planet!)}>
          {s.text}
        </span>
      );
    case DialogueSubstitutionType.CharacterName:
      return <span className="sub-character">{s.text}</span>;
    case DialogueSubstitutionType.Generic:
      return <span className="sub-generic">{s.text}</span>;
    case DialogueSubstitutionType.Unknown:
    default: {
      console.warn(`Unknown substitution ${s.s_type} text ${s.text}`);
      return <span>{s.text}</span>;
    }
  }
};
export const substituteText = (
  text: string,
  subs: DialogueSubstitution[]
): ReactNode[] => {
  const parts = text.split(/s_\w+/);
  const substitutions = subs.map((s, i) => {
    return <span key={i}>{enrichSub(s)}</span>;
  });
  return _.flatMap(_.zip(parts, substitutions), (elem, i) => (
    <span key={i}>{elem}</span>
  ));
};
