import { useStore } from '../store';
import { ControlledMenu, MenuItem } from '@szhsin/react-menu';
import _ from 'lodash';
import React, { useEffect, useState } from 'react';
import './GlobalContextMenu.scss';

export interface GlobalContextMenuItem {
  id: string;
  text: string;
  onClick: () => void;
}

const REPOSITION_INTERVAL = 100;
export const GlobalContextMenu = () => {
  const menuAnchorRef = useStore((state) => state.contextMenuRef);
  const isMenuOpen = useStore((state) => state.contextMenuItems.length > 0);
  const items = useStore((state) => state.contextMenuItems);
  const [counter, setCounter] = useState(0);
  useEffect(() => {
    const timer = setInterval(
      () => setCounter((c: number) => c + 1),
      REPOSITION_INTERVAL
    );
    return () => {
      clearInterval(timer);
    };
  }, []);
  return (
    <ControlledMenu
      animation={false}
      anchorRef={menuAnchorRef}
      isOpen={isMenuOpen}
      className="global-context-menu"
      repositionFlag={counter}
    >
      {items.map((item, i) => (
        <MenuItem
          className="menu-item"
          onClick={item.onClick}
          key={_.isNil(item.id) ? i : item.id}
        >
          {item.text}
        </MenuItem>
      ))}
    </ControlledMenu>
  );
};
