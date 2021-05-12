// @ts-ignore
import React from 'react';
import './NotificationPanel.scss';
import { Notification, NotificationUnknown } from '../../../world/pkg';
import { UnreachableCaseError } from 'ts-essentials';
import { BsQuestionCircle } from 'react-icons/all';
import Tippy from '@tippyjs/react';
import 'tippy.js/dist/tippy.css'; // optional

type NotificationPanelProps = {
  notifications: Notification[];
};

export const NotificationPanel: React.FC<NotificationPanelProps> = ({
  notifications,
}) => {
  const notificationsFiltered: Exclude<
    Notification,
    NotificationUnknown
  >[] = [];
  for (const notification of notifications) {
    if (notification.tag !== 'Unknown') {
      notificationsFiltered.push(notification);
    }
  }
  return (
    <div className="notification-panel">
      {notificationsFiltered.map((not) => {
        const notification: {
          icon?: React.ReactNode;
          text?: string;
        } = {};
        switch (not.tag) {
          case 'Help':
            notification.icon = <BsQuestionCircle />;
            notification.text = not.text.text;
            break;
          default:
            throw new UnreachableCaseError(not.tag);
        }
        return (
          <div key={not.id}>
            <Tippy content={<span>{notification.text}</span>}>
              <span>{notification.icon}</span>
            </Tippy>
          </div>
        );
      })}
    </div>
  );
};
