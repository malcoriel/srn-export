// @ts-ignore
import React from 'react';
import './NotificationPanel.scss';
import { Notification, NotificationUnknown } from '../../../world/pkg';
import { UnreachableCaseError } from 'ts-essentials';
import { FaQuestion, FaTasks, ImClipboard } from 'react-icons/all';
import Tippy from '@tippyjs/react';
import 'tippy.js/dist/tippy.css';
import { StyledRect } from './ui/StyledRect';
import _ from 'lodash'; // optional

type NotificationPanelProps = {
  notifications: Notification[];
  className?: string;
};

const styleText = (notification: {
  icon?: React.ReactNode;
  text: string;
  adjustClass?: string;
  header: string;
}): React.ReactNode => {
  const parts = notification.text.split('\n');
  const newParts = _.flatten(
    _.zip(
      parts,
      _.times(parts.length, () => <br />)
    )
  );
  return (
    <>
      {newParts.map((p, i) => {
        return <span key={i}>{p}</span>;
      })}
    </>
  );
};

export const NotificationPanel: React.FC<NotificationPanelProps> = ({
  notifications,
  className,
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
    <div className={`notification-panel ${className || ''}`}>
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
              placement="top-start"
              animation={false}
              interactive
              hideOnClick={false}
              popperOptions={{
                modifiers: [
                  {
                    name: 'offset',
                    options: {
                      offset: [0, 2],
                    },
                  },
                ],
              }}
              content={
                <StyledRect
                  width={300}
                  autoHeight
                  thickness={4}
                  line="thin"
                  contentClassName="notification-tooltip"
                >
                  <div className="header">{notification.header}</div>
                  <div className="text">{styleText(notification)}</div>
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
