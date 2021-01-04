import React, { useRef, useState } from 'react';
import './DialoguePanel.scss';

import { Canvas, useFrame } from 'react-three-fiber';
import { Vector3 } from 'three';
import {
  CAMERA_DEFAULT_ZOOM,
  CAMERA_HEIGHT,
} from '../ThreeLayers/CameraControls';
import { ThreePlanetShape } from '../ThreeLayers/ThreePlanetShape';
import NetState from '../NetState';
import _ from 'lodash';
import { DialogueElem } from '../world';

const DialogueElemView: React.FC<DialogueElem> = (dialogue) => (
  <div className="dialogue-option">{dialogue.text}</div>
);

export const DialoguePanel: React.FC = () => {
  const ns = NetState.get();
  if (!ns) return null;

  const {
    state: { dialogue },
  } = ns;

  if (!dialogue) return null;

  return (
    <div className="dialogue panel-base">
      <div className="top-part">
        <div className="left-character">
          <img src={dialogue.left_character_url} alt="left-character-image" />
        </div>
        <div className="scene">
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
        <div className="right-character">
          <img src={dialogue.right_character_url} alt="right-character-image" />
        </div>
      </div>
      <div className="prompt">
        <DialogueElemView {...dialogue.prompt} />
      </div>
      <div className="options">
        {dialogue.options.map((option, i) => (
          <div
            className="line"
            onClick={() => ns.sendDialogueOption(option.id)}
          >
            {i + 1}.&nbsp;
            <DialogueElemView key={option.id} {...option} />
          </div>
        ))}
      </div>
    </div>
  );
};
