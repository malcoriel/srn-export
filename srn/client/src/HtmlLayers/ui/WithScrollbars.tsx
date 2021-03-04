import { Scrollbars, ScrollValues } from 'rc-scrollbars';
import React, { useEffect, useRef, useState } from 'react';
import './WithScrollbars.scss';

const shouldShadow = (values: ScrollValues) => {
  let doShadow = values.clientHeight !== values.scrollHeight && values.top < 1;
  let opacity = Math.abs(values.top - 1) * 0.75;
  return doShadow ? opacity : 0;
};

const padRight = '20px';
export const WithScrollbars: React.FC<{
  noAutoHide?: boolean;
  autoScrollDown?: boolean;
  paddedRight?: boolean;
}> = ({ children, noAutoHide, autoScrollDown, paddedRight }) => {
  const ref = useRef<Scrollbars>(null);
  useEffect(() => {
    if (autoScrollDown && ref && ref.current) {
      ref.current.scrollToBottom();
    } else if (ref && ref.current) {
      setShadowed(shouldShadow(ref.current.getValues()));
    }
  }, [children]);
  const [shadowOpacity, setShadowed] = useState(0);

  return (
    <div
      className='with-scrollbars'
      style={{ width: '100%', height: '100%', position: 'relative' }}
    >
      <div className="scroll-shadow" style={{boxShadow: `0px -25px 32px 3px rgba(0,0,0,${shadowOpacity}) inset`}} />
      <Scrollbars
        onScrollFrame={(values) => {
          setShadowed(shouldShadow(values));
        }}
        ref={ref}
        autoHide={!noAutoHide}
        renderThumbHorizontal={(props) => <div {...props} className='ui-thumb' />}
        renderThumbVertical={(props) => <div {...props} className='ui-thumb' />}
        style={{ width: '100%', height: '100%' }}
      >
        <div style={{ paddingRight: paddedRight ? padRight : undefined }}
        >
          {children}
        </div>
      </Scrollbars></div>
  );
};
