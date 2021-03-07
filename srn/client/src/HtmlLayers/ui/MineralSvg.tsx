import * as React from 'react';

const MineralSvg: React.FC<{
  width: number;
  height: number;
  fillColor: string;
  strokeColor: string;
}> = ({ strokeColor, fillColor, height, width }) => (
  <div style={{ width, height, transform: 'scale(0.7) rotate(80deg)' }}>
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 26.458 26.458"
      height={height}
      width={width}
    >
      <path
        d="M12.987.025a5.175 10.923 0 00-4.923 7.642 3.8 4.087 0 00-.372-.02 3.8 4.087 0 00-3.8 4.087 3.8 4.087 0 00.164 1.19 7.143 5.62 0 00-4.03 5.06 7.143 5.62 0 007.142 5.62 7.143 5.62 0 001.351-.102 2.425 1.533 0 001.722.929 4.718 5.62 0 003.61 2.002 4.718 5.62 0 004.096-2.83 1.638 2.083 0 001.559-1.587 7.438 6.406 0 006.927-6.39 7.438 6.406 0 00-6.282-6.329 3.145 3.93 0 00-2.37-2.524A5.175 10.923 0 0013 .025a5.175 10.923 0 00-.013 0z"
        stroke={strokeColor}
        strokeWidth={1}
        fill={fillColor}
      />
    </svg>
  </div>
);

export default MineralSvg;
