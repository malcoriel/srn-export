import React, { useMemo } from 'react';
import './StyledRect.scss';

export const StyledRect: React.FC<{
  width?: number;
  height?: number;
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
  autoHeight?: boolean;
  autoWidth?: boolean;
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
  autoHeight,
  autoWidth,
}) => {
  const computeStyles = () => {
    const thicknessCoeff = halfThick ? 0.5 : 1.0;
    const bgSizeHorizontal = `${thickness * 10}px ${thickness}px`;
    const bgSizeVertical = `${thickness}px ${thickness * 10}px`;
    const bgSizeCorner = `${thickness}px ${thickness}px`;
    const padding = `${noTop ? 0 : thickness}px ${noRight ? 0 : thickness}px ${
      noBottom ? 0 : thickness
    }px ${noLeft ? 0 : thickness}px `;
    const mainDivStyle = {
      width,
      height,
      padding,
    };
    const topStyle = {
      width,
      height: thickness * thicknessCoeff,
      backgroundSize: bgSizeHorizontal,
    };
    const leftStyle = {
      height,
      width: thickness * thicknessCoeff,
      backgroundSize: bgSizeVertical,
    };
    const bottomStyle = {
      width,
      height: thickness * thicknessCoeff,
      backgroundSize: bgSizeHorizontal,
    };
    const rightStyle = {
      height,
      width: thickness * thicknessCoeff,
      backgroundSize: bgSizeVertical,
    };
    const topLeftStyle = {
      width: thickness,
      height: thickness,
      backgroundSize: bgSizeCorner,
    };
    const topRightStyle = {
      width: thickness,
      height: thickness,
      backgroundSize: bgSizeCorner,
    };
    const bottomLeftStyle = {
      width: thickness,
      height: thickness,
      backgroundSize: bgSizeCorner,
    };
    const bottomRightStyle = {
      width: thickness,
      height: thickness,
      backgroundSize: bgSizeCorner,
    };

    if (autoHeight) {
      // @ts-ignore
      mainDivStyle.height = 'auto';
      // @ts-ignore
      leftStyle.height = `calc(100% - ${thickness * 2}px)`;
      // @ts-ignore
      rightStyle.height = `calc(100% - ${thickness * 2}px)`;
    } else if (autoWidth) {
      // @ts-ignore
      mainDivStyle.width = 'auto';
      const extraWidth =
        Number(!noLeft) * thickness + Number(!noRight) * thickness;
      // @ts-ignore
      topStyle.width = `calc(100% - ${extraWidth}px)`;
      // @ts-ignore
      bottomStyle.width = `calc(100% - ${extraWidth}px)`;
    }

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

  const {
    mainDivStyle,
    topStyle,
    leftStyle,
    bottomStyle,
    rightStyle,
    topLeftStyle,
    topRightStyle,
    bottomLeftStyle,
    bottomRightStyle,
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
