import React, { useMemo } from 'react';
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
  const computeStyles = () => {
    let thicknessCoeff = halfThick ? 0.5 : 1.0;
    let bgSizeHorizontal = `${thickness * 10}px ${thickness}px`;
    let bgSizeVertical = `${thickness}px ${thickness * 10}px`;
    let bgSizeCorner = `${thickness}px ${thickness}px`;
    let padding = `${noTop ? 0 : thickness}px ${noRight ? 0 : thickness}px ${
      noBottom ? 0 : thickness
    }px ${noLeft ? 0 : thickness}px `;
    let mainDivStyle = {
      width,
      height,
      padding,
    };
    let topStyle = {
      width,
      height: thickness * thicknessCoeff,
      backgroundSize: bgSizeHorizontal,
    };
    let leftStyle = {
      height,
      width: thickness * thicknessCoeff,
      backgroundSize: bgSizeVertical,
    };
    let bottomStyle = {
      width,
      height: thickness * thicknessCoeff,
      backgroundSize: bgSizeHorizontal,
    };
    let rightStyle = {
      height,
      width: thickness * thicknessCoeff,
      backgroundSize: bgSizeVertical,
    };
    let topLeftStyle = {
      width: thickness,
      height: thickness,
      backgroundSize: bgSizeCorner,
    };
    let topRightStyle = {
      width: thickness,
      height: thickness,
      backgroundSize: bgSizeCorner,
    };
    let bottomLeftStyle = {
      width: thickness,
      height: thickness,
      backgroundSize: bgSizeCorner,
    };
    let bottomRightStyle = {
      width: thickness,
      height: thickness,
      backgroundSize: bgSizeCorner,
    };
    return {
      mainDivStyle,
      topStyle,
      leftStyle,
      bottomStyle,
      rightStyle,
      topLeftStyle,
      topRightStyle,
      bottomLeftStyle,
      bottomRightStyle,
    };
  };

  let {
    mainDivStyle,
    topStyle,
    leftStyle,
    bottomStyle,
    rightStyle,
    topLeftStyle,
    topRightStyle,
    bottomLeftStyle,
    bottomRightStyle,
  } = useMemo(computeStyles, []);

  return (
    <div className={`styled-rect ${line} ${className}`} style={mainDivStyle}>
      {!noTop && <div className="horizontal top" style={topStyle} />}
      {!noLeft && <div className="vertical left" style={leftStyle} />}
      {!noBottom && <div className="horizontal bottom" style={bottomStyle} />}
      {!noRight && <div className="vertical right" style={rightStyle} />}
      {!noTop && !noLeft && (
        <div className="corner top-left" style={topLeftStyle} />
      )}
      {!noTop && !noRight && (
        <div className="corner top-right" style={topRightStyle} />
      )}
      {!noBottom && !noLeft && (
        <div className="corner bottom-left" style={bottomLeftStyle} />
      )}
      {!noBottom && !noRight && (
        <div className="corner bottom-right" style={bottomRightStyle} />
      )}
      <div className={`content ${contentClassName}`}>{children}</div>
    </div>
  );
};
