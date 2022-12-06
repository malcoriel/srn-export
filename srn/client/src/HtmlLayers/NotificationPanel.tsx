import React from 'react';
import './NotificationPanel.scss';
import {
  Notification,
  NotificationActionR,
  NotificationUnknown,
  Substitution,
} from '../../../world/pkg';
import { UnreachableCaseError } from 'ts-essentials';
import { FaQuestion, FaTasks } from 'react-icons/fa';
import Tippy from '@tippyjs/react';
import 'tippy.js/dist/tippy.css';
import { StyledRect } from './ui/StyledRect';
import { NotificationActionRBuilder } from '../../../world/pkg/world.extra';
import { transformAllTextSubstitutions } from '../utils/substitutions';

type NotificationPanelProps = {
  notifications: Notification[];
  className?: string;
  onAction?: (act: NotificationActionR) => void;
  onFocusObject?: (id: string) => void;
};

const styleText = (
  notification: {
    icon?: React.ReactNode;
    text: string;
    adjustClass?: string;
    header: string;
    substitutions: Substitution[];
  },
  onFocusObject: (id: string) => void
): React.ReactNode => {
  return (
    <>
      {transformAllTextSubstitutions(
        notification.text,
        notification.substitutions,
        {
          onFocusObject,
        }
      ).map((el, i) =>
        React.cloneElement(el as React.ReactElement, {
          key: i,
        })
      )}
    </>
  );
};

export const NotificationPanel: React.FC<NotificationPanelProps> = ({
  notifications,
  className,
  onAction,
  onFocusObject = (_id) => undefined,
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
                    NotificationActionRBuilder.NotificationActionRDismiss({
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
                    <div className="text">
                      {styleText(notification, onFocusObject)}
                    </div>
                    <div className="dismiss-hint">
                      {notification.isDismissable
                        ? 'right-click the icon to dismiss this notification'
                        : 'this notification is not dismissable'}
                    </div>
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
