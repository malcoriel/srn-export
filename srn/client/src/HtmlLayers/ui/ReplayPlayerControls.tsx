import './ReplayPlayerControls.scss';
import React, { useEffect, useRef, useState } from 'react';
import Slider from 'rc-slider';
import 'rc-slider/assets/index.css';
import { teal } from '../../utils/palette';
import { Button } from './Button';
import { BsFillPlayFill, BsPauseFill } from 'react-icons/bs';

export type ReplayPlayerMark = {
  id: string | number;
  timeMs: number;
};

export type ReplayPlayerControlsProps = {
  maxTimeMs: number;
  value: number;
  onChange: (x: number) => void;
  onPlay: () => void;
  onPause: () => void;
  playing: boolean;
  marks?: ReplayPlayerMark[];
};
export const ReplayPlayerControls: React.FC<ReplayPlayerControlsProps> = ({
  maxTimeMs,
  value,
  onChange,
  marks = [],
  onPlay,
  onPause,
  playing,
}) => {
  const prevPlaying = useRef(false);
  useEffect(() => {
    // when paused at the end, play should start replay
    console.log({
      playing,
      value,
      maxTimeMs,
      prevPlaying: prevPlaying.current,
    });
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
    <div className="replay-player-controls">
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
          {marks.map(({ id, timeMs }) => (
            <div
              className="mark"
              key={id}
              style={{ left: `calc(${(timeMs / maxTimeMs) * 100}% - 1px)` }}
              onClick={() => onChange(timeMs)}
            />
          ))}
        </div>
      </div>
    </div>
  );
};
