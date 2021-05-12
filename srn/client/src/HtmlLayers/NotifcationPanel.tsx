// @ts-ignore
import React from 'react';
import './NotificationPanel.scss';
import { Notification, NotificationUnknown } from '../../../world/pkg';
import { UnreachableCaseError } from 'ts-essentials';
import { BiTask, FaQuestion, FaTasks, ImClipboard } from 'react-icons/all';
import Tippy from '@tippyjs/react';
import 'tippy.js/dist/tippy.css';
import { StyledRect } from './ui/StyledRect'; // optional

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
      {notificationsFiltered.map((rawNotification) => {
        const notification: {
          icon?: React.ReactNode;
          text: string;
          adjustClass?: string;
          header: string;
        } = {
          header: rawNotification.header,
          text: rawNotification.text.text,
        };
        switch (rawNotification.tag) {
          case 'Help':
            notification.icon = <FaQuestion />;
            break;
          case 'Task':
            notification.icon = <FaTasks />;
            notification.adjustClass = 'size-10';
            break;
          default:
            throw new UnreachableCaseError(rawNotification);
        }
        return (
          <div key={rawNotification.id} className="notification">
            <Tippy
              arrow={false}
              animation={false}
              content={
                <StyledRect
                  width={100}
                  height={100}
                  thickness={4}
                  line="thin"
                  contentClassName="notification-tooltip"
                >
                  <div className="header">{notification.header}</div>
                  <div className="text">{notification.text}</div>
                </StyledRect>
              }
            >
              <span
                className={`icon-outline ${notification.adjustClass || ''}`}
              >
                {notification.icon}
              </span>
            </Tippy>
          </div>
        );
      })}
    </div>
  );
};
