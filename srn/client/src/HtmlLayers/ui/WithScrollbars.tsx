import { Scrollbars } from 'rc-scrollbars';
import React, { useEffect, useRef } from 'react';
import './WithScrollbars.scss';

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
    }
  });
  return (
    <Scrollbars
      ref={ref}
      autoHide={!noAutoHide}
      renderThumbHorizontal={(props) => <div {...props} className='ui-thumb' />}
      renderThumbVertical={(props) => <div {...props} className='ui-thumb' />}
      style={{ width: '100%', height: '100%' }}
    >
      <div style={{ paddingRight: paddedRight ? padRight : undefined }}>{children}
      </div>
    </Scrollbars>
  );
};
