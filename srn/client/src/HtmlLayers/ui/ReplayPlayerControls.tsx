import './ReplayPlayerControls.scss';
import React, { useEffect, useRef, useState } from 'react';
import Slider from 'rc-slider';
import 'rc-slider/assets/index.css';
import { teal } from '../../utils/palette';
import { Button } from './Button';
import { BsFillPlayFill, BsPauseFill } from 'react-icons/bs';
import classNames from 'classnames';

export type ReplayPlayerControlsProps = {
  maxTimeMs: number;
  value: number;
  onChange: (x: number) => void;
  onPlay: () => void;
  onPause: () => void;
  playing: boolean;
  bottom?: boolean;
  marks?: number[];
};
export const ReplayPlayerControls: React.FC<ReplayPlayerControlsProps> = ({
  maxTimeMs,
  value,
  onChange,
  marks = [],
  onPlay,
  onPause,
  bottom,
  playing,
}) => {
  const prevPlaying = useRef(false);
  useEffect(() => {
    // when paused at the end, play should start replay
    if (playing && value >= maxTimeMs && !prevPlaying.current) {
      onChange(0);
      // that's a dirty trick to avoid property synchronization
      setTimeout(() => onPlay(), 0);
    }
  }, [value, maxTimeMs, onPlay, playing, onChange]);
  useEffect(() => {
    prevPlaying.current = playing;
  }, [playing]);
  useEffect(() => {
    if (value >= maxTimeMs && playing) {
      onPause();
    }
  }, [onPause, value, maxTimeMs, playing, onPlay]);
  return (
    <div className={classNames({ 'replay-player-controls': true, bottom })}>
      <div className="buttons">
        {!playing ? (
          <Button borderless onClick={onPlay}>
            <BsFillPlayFill />
          </Button>
        ) : (
          <Button borderless onClick={onPause}>
            <BsPauseFill />
          </Button>
        )}
      </div>
      <div className="slider">
        <Slider
          min={0}
          max={maxTimeMs}
          handleStyle={{
            backgroundColor: teal,
          }}
          trackStyle={{
            backgroundColor: teal,
          }}
          railStyle={{
            backgroundColor: teal,
          }}
          value={value}
          onChange={onChange}
        />
        <div className="marks">
          {marks.map((time) => (
            <div
              className="mark"
              key={time}
              style={{ left: `calc(${(time / maxTimeMs) * 100}% - 1px)` }}
              onClick={() => onChange(time)}
            />
          ))}
        </div>
      </div>
    </div>
  );
};
