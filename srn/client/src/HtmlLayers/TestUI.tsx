import React from 'react';
import './TestUI.scss';

const StyledRect: React.FC<{
  width: number;
  height: number;
  thickness: number;
  children: React.ReactNode;
  contentClassName?: string;
}> = ({ width, height, contentClassName, thickness, children }) => {
  let bgSizeHorizontal = `${thickness * 10}px ${thickness}px`;
  let bgSizeVertical = `${thickness}px ${thickness * 10}px`;
  let bgSizeCorner = `${thickness}px ${thickness}px`;
  return (
    <div
      className="styled-rect"
      style={{
        width,
        height,
        padding: thickness,
      }}
    >
      <div
        className="horizontal top"
        style={{
          width,
          height: thickness,
          backgroundSize: bgSizeHorizontal,
        }}
      />
      <div
        className="vertical left"
        style={{
          height,
          width: thickness,
          backgroundSize: bgSizeVertical,
        }}
      />
      <div
        className="horizontal bottom"
        style={{
          width,
          height: thickness,
          backgroundSize: bgSizeHorizontal,
        }}
      />
      <div
        className="vertical right"
        style={{
          height,
          width: thickness,
          backgroundSize: bgSizeVertical,
        }}
      />
      <div
        className="corner top-left"
        style={{
          width: thickness,
          height: thickness,
          backgroundSize: bgSizeCorner,
        }}
      />
      <div
        className="corner top-right"
        style={{
          width: thickness,
          height: thickness,
          backgroundSize: bgSizeCorner,
        }}
      />
      <div
        className="corner bottom-left"
        style={{
          width: thickness,
          height: thickness,
          backgroundSize: bgSizeCorner,
        }}
      />
      <div
        className="corner bottom-right"
        style={{
          width: thickness,
          height: thickness,
          backgroundSize: bgSizeCorner,
        }}
      />
      <div
        className={`content ${contentClassName}`}
        style={{
          width: thickness,
          height: thickness,
          backgroundSize: bgSizeCorner,
        }}
      >
        {children}
      </div>
    </div>
  );
};

export const TestUI = () => (
  <div className="test-ui">
    <StyledRect width={238} height={800} thickness={8}>
      My text
    </StyledRect>
  </div>
);
