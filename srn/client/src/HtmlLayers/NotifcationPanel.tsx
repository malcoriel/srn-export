import React from 'react';
import './NotificationPanel.scss';
import {
  Notification,
  NotificationAction,
  NotificationUnknown,
  Substitution,
} from '../../../world/pkg';
import { UnreachableCaseError } from 'ts-essentials';
import { FaQuestion, FaTasks } from 'react-icons/all';
import Tippy from '@tippyjs/react';
import 'tippy.js/dist/tippy.css';
import { StyledRect } from './ui/StyledRect';
import _ from 'lodash';
import { NotificationActionBuilder } from '../../../world/pkg/world.extra';
import { substituteText } from './DialogueWindow';

type NotificationPanelProps = {
  notifications: Notification[];
  className?: string;
  onAction?: (act: NotificationAction) => void;
};

const styleText = (notification: {
  icon?: React.ReactNode;
  text: string;
  adjustClass?: string;
  header: string;
  substitutions: Substitution[];
}): React.ReactNode => {
  const textWithSubs = substituteText(
    notification.text,
    notification.substitutions
  );
  //const res = replaceLineBreaks(notification.text);

  return <>{notification.text}</>;
};

export const NotificationPanel: React.FC<NotificationPanelProps> = ({
  notifications,
  className,
  onAction,
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
    <StyledRect
      height={26}
      autoWidth
      line="thin"
      thickness={4}
      halfThick
      noBottom
      noRight
      noLeft
    >
      <div className={`notification-panel ${className || ''}`}>
        {notificationsFiltered.map((rawNotification) => {
          const notification: {
            icon?: React.ReactNode;
            text: string;
            adjustClass?: string;
            header: string;
            isDismissable: boolean;
            substitutions: Substitution[];
          } = {
            header: rawNotification.header,
            text: rawNotification.text.text,
            isDismissable: true,
            substitutions: rawNotification.text.substitutions,
          };
          switch (rawNotification.tag) {
            case 'Help':
              notification.icon = <FaQuestion />;
              break;
            case 'Task':
              notification.icon = <FaTasks />;
              notification.adjustClass = 'size-12';
              notification.isDismissable = false;
              break;
            default:
              throw new UnreachableCaseError(rawNotification);
          }
          return (
            <div
              key={rawNotification.id}
              className="notification"
              onContextMenu={(e) => {
                if (onAction && notification.isDismissable) {
                  onAction(
                    NotificationActionBuilder.NotificationActionDismiss({
                      id: rawNotification.id,
                    })
                  );
                }
                e.preventDefault();
                return false;
              }}
            >
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
                    {notification.isDismissable && (
                      <div className="dismiss-hint">
                        right-click the icon to dismiss this notification
                      </div>
                    )}
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
    </StyledRect>
  );
};
