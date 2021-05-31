import { useStore } from '../store';
import { ControlledMenu, MenuItem } from '@szhsin/react-menu';
import _ from 'lodash';
import React from 'react';

export interface GlobalContextMenuItem {
  id: string;
  text: string;
  onClick: () => void;
}

export const GlobalContextMenu = () => {
  const menuAnchorRef = useStore((state) => state.contextMenuRef);
  const isMenuOpen = useStore((state) => state.contextMenuItems.length > 0);
  const items = useStore((state) => state.contextMenuItems);
  return (
    <ControlledMenu
      animation={false}
      anchorRef={menuAnchorRef}
      isOpen={isMenuOpen}
    >
      {items.map((item, i) => (
        <MenuItem onClick={item.onClick} key={_.isNil(item.id) ? i : item.id}>
          {item.text}
        </MenuItem>
      ))}
    </ControlledMenu>
  );
};
