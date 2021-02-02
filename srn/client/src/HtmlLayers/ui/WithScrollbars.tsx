import { Scrollbars } from 'rc-scrollbars';
import React from 'react';
import "./WithScrollbars.scss";

export const WithScrollbars: React.FC<{noAutoHide?:boolean}> = ({children, noAutoHide}) => <Scrollbars
  autoHide={!noAutoHide}
  renderThumbHorizontal={(props) => <div {...props} className='ui-thumb' />}
  renderThumbVertical={(props) => <div {...props} className='ui-thumb' />}
  style={{ width: '100%', height: '100%' }}>
  {children}
</Scrollbars>
