import React, { ReactNode, useEffect, useState } from 'react';
import './DialoguePanel.scss';
import { Window } from './ui/Window';
import { Canvas } from 'react-three-fiber';
import { Vector3 } from 'three';
import { CAMERA_DEFAULT_ZOOM, CAMERA_HEIGHT } from '../ThreeLayers/CameraControls';
import { ThreePlanetShape } from '../ThreeLayers/ThreePlanetShape';
import NetState from '../NetState';
import _ from 'lodash';
import { useHotkeys } from 'react-hotkeys-hook';
import { makePortraitPath } from './StartMenu';
import { Dialogue, DialogueElem, DialogueSubstitution, DialogueSubstitutionType, Planet } from '../world';
import { useStore, WindowState } from '../store';
import { findPlanet } from './NetworkStatus';


export const DialogueElemView: React.FC<DialogueElem> = (dialogue) => (
  <span className='dialogue-option'>
    {substituteText(dialogue.text, dialogue.substitution)}
  </span>
);
const renderContent = (dialogue: Dialogue, ns: NetState) => (
  <div className='dialogue'>
    <div className='top-part'>
      <div className='left-character'>
        {/* eslint-disable-next-line jsx-a11y/alt-text */}
        <img
          src={makePortraitPath(dialogue.left_character)}
        />
      </div>
      <div className='scene'>
        <Canvas
          style={{ width: 200, height: 200, backgroundColor: 'black' }}
          orthographic
          camera={{
            position: new Vector3(0, 0, CAMERA_HEIGHT),
            zoom: CAMERA_DEFAULT_ZOOM() * 0.5,
          }}
        >
          <ambientLight />
          <pointLight position={[10, 10, 10]} />
          {dialogue.planet && (
            <ThreePlanetShape
              visible={true}
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
          )}
        </Canvas>
      </div>
      <div className='right-character'>
        {/* eslint-disable-next-line jsx-a11y/alt-text */}
        <img
          src={makePortraitPath(dialogue.right_character)}
        />
      </div>
    </div>
    <div className='prompt'>
      <DialogueElemView {...dialogue.prompt} />
    </div>
    <div className='options'>
      {dialogue.options.map((option, i) => (
        <div
          key={i}
          className='line'
          onClick={() => ns.sendDialogueOption(dialogue.id, option.id)}
        >
          {i + 1}.&nbsp;
          <DialogueElemView key={option.id} {...option} />
        </div>
      ))}
    </div>
    <div className='hint'>
      Hint: you can use numbers row (1-9) on the keyboard to select options
    </div>
  </div>
);

export const DialogueWindow: React.FC = () => {
  const ns = NetState.get();
  if (!ns) return null;

  const [, forceUpdate] = useState(false);
  const dialogueWindowState = useStore(state => state.dialogueWindow);
  const setDialogueWindowState = useStore(state => state.setDialogueWindow);
  useEffect(() => {
    const onDialogueChange = () => {
      if (dialogueWindowState === WindowState.Hidden) {
        setDialogueWindowState(WindowState.Shown);
      }
      forceUpdate(old => !old);
    };
    ns.on('dialogue', onDialogueChange);
    return () => {
      ns.off('dialogue', onDialogueChange);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ns.id]);

  const { dialogue } = ns;

  const tryDoOption = (i: number) => () => {
    if (!dialogue) return;
    const options = dialogue.options;
    if (!options) return;
    if (options[i]) {
      ns.sendDialogueOption(dialogue.id, options[i].id);
    }
  };

  for (const i of _.times(9)) {
    useHotkeys(String(i + 1), tryDoOption(i), [tryDoOption, dialogue]);
  }

  if (!dialogue) return null;

  return <Window
    contentClassName="dialogue-window-content"
    height={616}
    width={622}
    line={'thin'}
    halfThick
    storeKey='dialogueWindow'
    thickness={8}>
    {renderContent(dialogue, ns)}
  </Window>;
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
      let planet = findPlanet(ns.state, s.id);
      if (!planet) {
        console.warn(`substitution planet not found by id ${s.id}`);
        return <span className='sub-planet'>{s.text}</span>;
      }
      return (
        <span className='sub-planet found' onClick={() => focus(planet!)}>
          {s.text}
        </span>
      );
    case DialogueSubstitutionType.CharacterName:
      return <span className='sub-character'>{s.text}</span>;
    case DialogueSubstitutionType.Generic:
      return <span className='sub-generic'>{s.text}</span>;
    case DialogueSubstitutionType.Unknown:
    default: {
      console.warn(`Unknown substitution ${s.s_type} text ${s.text}`);
      return <span>{s.text}</span>;
    }
  }
};
export const substituteText = (
  text: string,
  subs: DialogueSubstitution[],
): ReactNode[] => {
  const parts = text.split(/s_\w+/);
  const substitutions = subs.map((s, i) => {
    return <span key={i}>{enrichSub(s)}</span>;
  });
  return _.flatMap(_.zip(parts, substitutions), (elem, i) => (
    <span key={i}>{elem}</span>
  ));
};