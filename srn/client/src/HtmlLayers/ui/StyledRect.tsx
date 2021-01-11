import React from 'react';
import './StyledRect.scss';

export const StyledRect: React.FC<{
  width: number;
  height: number;
  thickness: number;
  line: 'complex' | 'thick' | 'thin';
  halfThick?: boolean;
  children: React.ReactNode;
  contentClassName?: string;
  noTop?: boolean;
  noBottom?: boolean;
  noRight?: boolean;
  noLeft?: boolean;
  className?: string;
}> = ({
  width,
  height,
  halfThick,
  contentClassName,
  thickness,
  line,
  children,
  noTop,
  noBottom,
  noRight,
  noLeft,
  className,
}) => {
  let thicknessCoeff = halfThick ? 0.5 : 1.0;
  let bgSizeHorizontal = `${thickness * 10}px ${thickness}px`;
  let bgSizeVertical = `${thickness}px ${thickness * 10}px`;
  let bgSizeCorner = `${thickness}px ${thickness}px`;
  let padding = `${noTop ? 0 : thickness}px ${noRight ? 0 : thickness}px ${
    noBottom ? 0 : thickness
  }px ${noLeft ? 0 : thickness}px `;
  return (
    <div
      className={`styled-rect ${line} ${className}`}
      style={{
        width,
        height,
        padding,
      }}
    >
      {!noTop && (
        <div
          className="horizontal top"
          style={{
            width,
            height: thickness * thicknessCoeff,
            backgroundSize: bgSizeHorizontal,
          }}
        />
      )}
      {!noLeft && (
        <div
          className="vertical left"
          style={{
            height,
            width: thickness * thicknessCoeff,
            backgroundSize: bgSizeVertical,
          }}
        />
      )}
      {!noBottom && (
        <div
          className="horizontal bottom"
          style={{
            width,
            height: thickness * thicknessCoeff,
            backgroundSize: bgSizeHorizontal,
          }}
        />
      )}
      {!noRight && (
        <div
          className="vertical right"
          style={{
            height,
            width: thickness * thicknessCoeff,
            backgroundSize: bgSizeVertical,
          }}
        />
      )}
      {!noTop && !noLeft && (
        <div
          className="corner top-left"
          style={{
            width: thickness,
            height: thickness,
            backgroundSize: bgSizeCorner,
          }}
        />
      )}
      {!noTop && !noRight && (
        <div
          className="corner top-right"
          style={{
            width: thickness,
            height: thickness,
            backgroundSize: bgSizeCorner,
          }}
        />
      )}
      {!noBottom && !noLeft && (
        <div
          className="corner bottom-left"
          style={{
            width: thickness,
            height: thickness,
            backgroundSize: bgSizeCorner,
          }}
        />
      )}
      {!noBottom && !noRight && (
        <div
          className="corner bottom-right"
          style={{
            width: thickness,
            height: thickness,
            backgroundSize: bgSizeCorner,
          }}
        />
      )}
      <div className={`content ${contentClassName}`}>{children}</div>
    </div>
  );
};
