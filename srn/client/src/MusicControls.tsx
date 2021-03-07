import React, { useEffect, useRef, useState } from 'react';
import ReactJkMusicPlayer from 'react-jinke-music-player';
import { useStore } from './store';
const bgmTracks = [
  {
    name: 'c2',
    musicSrc: 'resources/bgm/c2.mp3',
    singer: 'aiva',
  },
  {
    name: 'c3',
    musicSrc: 'resources/bgm/c3.mp3',
    singer: 'aiva',
  },
  {
    name: 'c4',
    musicSrc: 'resources/bgm/c4.mp3',
    singer: 'aiva',
  },
  {
    name: 'c5',
    musicSrc: 'resources/bgm/c5.mp3',
    singer: 'aiva',
  },
  {
    name: 'c6',
    musicSrc: 'resources/bgm/c6.mp3',
    singer: 'aiva',
  },
];

export const MusicControls = () => {
  const [index, setIndex] = useState(0);
  const ref = useRef(null);
  useEffect(() => {
    const defaultPlayIndex =
      parseInt(String(Math.random() * bgmTracks.length), 10) % bgmTracks.length;
    setIndex(defaultPlayIndex);
  }, [index, setIndex]);
  const volume = useStore((state) => state.volume);

  useEffect(() => {
    if (ref && ref.current) {
      // @ts-ignore
      const audio = ref.current.getEnhanceAudio();
      audio.volume = volume / 100;
    }
  }, [volume]);
  return (
    <ReactJkMusicPlayer
      ref={ref}
      defaultVolume={volume / 100}
      toggleMode={false}
      showMiniProcessBar
      defaultPlayMode="shufflePlay"
      playIndex={index}
      audioLists={bgmTracks}
    />
  );
};
