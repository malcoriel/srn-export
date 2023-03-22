import React from 'react';
import {
  ThreeTrajectoryItem,
  ThreeTrajectoryItemProps,
} from './ThreeTrajectoryItem';

export interface ThreeTrajectoryProps {
  items: ThreeTrajectoryItemProps[];
}

export const ThreeTrajectory: React.FC<ThreeTrajectoryProps> = ({ items }) => {
  return (
    <>
      {items.map((item, i) => (
        <ThreeTrajectoryItem
          key={i}
          accNormalized={item.accNormalized}
          mainColor="teal"
          accColor="red"
          position={item.position}
          velocityNormalized={item.velocityNormalized}
        />
      ))}
    </>
  );
};
