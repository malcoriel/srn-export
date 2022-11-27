import { Scrollbars, ScrollValues } from 'rc-scrollbars';
import React, { useEffect, useRef, useState } from 'react';
import './WithScrollbars.scss';

const shouldShadow = (values: ScrollValues) => {
  const doShadow =
    values.clientHeight !== values.scrollHeight && values.top < 1;
  const opacity = Math.abs(values.top - 1) * 0.75;
  return doShadow ? opacity : 0;
};

const padRight = '20px';
export const WithScrollbars: React.FC<{
  noAutoHide?: boolean;
  autoScrollDown?: boolean;
  paddedRight?: boolean;
  shadowRgbOverride?: string;
}> = ({
  children,
  noAutoHide,
  autoScrollDown,
  paddedRight,
  shadowRgbOverride,
}) => {
  const ref = useRef<Scrollbars>(null);
  const [shadowOpacity, setShadowed] = useState(0);

  useEffect(() => {
    if (autoScrollDown && ref && ref.current) {
      ref.current.scrollToBottom();
    } else if (ref && ref.current) {
      setShadowed(shouldShadow(ref.current.getValues()));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [children]);

  const shadowRgb = shadowRgbOverride || '0,0,0';

  return (
    <div
      className="with-scrollbars"
      style={{ width: '100%', height: '100%', position: 'relative' }}
    >
      <div
        className="scroll-shadow"
        style={{
          boxShadow: `0px -25px 32px 3px rgba(${shadowRgb},${shadowOpacity}) inset`,
        }}
      />
      <Scrollbars
        onScrollFrame={(values) => {
          setShadowed(shouldShadow(values));
        }}
        ref={ref}
        autoHide={!noAutoHide}
        renderThumbHorizontal={(props) => (
          <div {...props} className="ui-thumb" />
        )}
        renderThumbVertical={(props) => <div {...props} className="ui-thumb" />}
        style={{ width: '100%', height: '100%' }}
      >
        <div style={{ paddingRight: paddedRight ? padRight : undefined }}>
          {children}
        </div>
      </Scrollbars>
    </div>
  );
};
