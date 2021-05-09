import { QuickMenu } from './ui/QuickMenu';
import React from 'react';
import NetState, { useNSForceChange } from '../NetState';
import { ImFloppyDisk } from 'react-icons/all';
import _ from 'lodash';
import { LongActionStartBuilder } from '../../../world/pkg/world.extra';

export const NormalQuickMenu = () => {
  const ns = NetState.get();
  if (!ns) return null;
  useNSForceChange('NormalQuickMenu', false, (oldState, newState) => {
    return oldState.locations[0].id !== newState.locations[0].id;
  });

  const currentLocation = ns.state.locations[0];
  if (!currentLocation) {
    return null;
  }

  const loc_by_id = _.keyBy(ns.state.locations, 'id');

  const actions = [
    {
      text: 'Jump to another system',
      icon: <ImFloppyDisk />,
      list: true,
      children: currentLocation.adjacent_location_ids.map((id: string) => {
        let text: string;
        const loc = loc_by_id[id];
        if (loc && loc.star) {
          text = `${loc.star.name}`;
        } else {
          text = `${id}`;
        }
        return {
          text,
          handler: () =>
            ns.startLongAction(
              LongActionStartBuilder.LongActionStartTransSystemJump({ to: id })
            ),
        };
      }),
    },
  ];
  return <QuickMenu startActions={actions} mainHotkey="e" />;
};
