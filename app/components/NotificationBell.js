'use client';
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon } from '@/app/v3/ui';
import { useTopbarPanel } from './topbarPanel';

export default function NotificationBell({ employeeId }) {
  const [notifications, setNotifications] = useState([]);
  // מונה "לא נקראו" מהבדיקה הקלה (?light=1). הרשימה המלאה נטענת רק בפתיחת הפעמון.
  const [unreadFromPoll, setUnreadFromPoll] = useState(0);
  const { open: isOpen, close: closePanel, openPanel, itemProps, triggerProps } = useTopbarPanel({ hover: false }); // בלי פתיחה בריחוף: פתיחה = קריאת GET /api/notifications מלאה (כמו הכפתור הישן - רק בלחיצה)
  const isOpenRef = useRef(false);
  const pathname = usePathname();

  useEffect(() => {
    isOpenRef.current = isOpen;
  }, [isOpen]);

  const fetchNotifications = () => {
    if (!employeeId) return;
    fetch('/api/notifications')
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setNotifications(data.notifications || []);
        }
      })
      .catch(err => console.error('Failed to fetch notifications:', err));
  };

  // בדיקה קלה לנקודה האדומה - מונה בלבד, בלי תוכן ההודעות (ר' ההערה ב-app/api/notifications/route.js).
  const fetchUnreadCount = () => {
    if (!employeeId) return;
    fetch('/api/notifications?light=1')
      .then(res => res.json())
      .then(data => {
        if (data.success && typeof data.unreadCount === 'number') {
          setUnreadFromPoll(data.unreadCount);
          // הפעמון סגור - רשימה שנטענה קודם כבר עלולה להיות מיושנת, אז המונה העדכני הוא מקור האמת
          if (!isOpenRef.current) setNotifications([]);
        }
      })
      .catch(() => {});
  };

  useEffect(() => {
    fetchUnreadCount();
    let interval = null;
    const startPolling = () => {
      if (interval) return;
      // 120 שנ' (היה 60, ורשימה מלאה): כל טיק הוא invocation + שאילתת DB לכל טאב פתוח.
      interval = setInterval(fetchUnreadCount, 120000);
    };
    const stopPolling = () => {
      clearInterval(interval);
      interval = null;
    };
    // Background/minimized tabs were polling forever - pause while hidden so an
    // employee's idle tab doesn't keep hitting the API all day, and catch up
    // immediately when they come back instead of waiting for the next tick.
    const handleVisibility = () => {
      if (document.hidden) {
        stopPolling();
      } else {
        fetchUnreadCount();
        startPolling();
      }
    };
    if (!document.hidden) startPolling();
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      stopPolling();
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [employeeId]);

  // NotificationBell lives once in AppShell and never remounts on client-side
  // navigation, so reads marked on /messages (a separate fetch/state) would
  // otherwise sit stale here for up to the 60s poll interval. Re-sync on every
  // route change and whenever the dropdown is opened so the dot/count reflect
  // reads made elsewhere without waiting for the interval.
  useEffect(() => {
    // מונה בלבד - הרשימה המלאה נטענת בפתיחת הפעמון (הכפתור למטה)
    fetchUnreadCount();
  }, [pathname]);

  // v3: הפרסום 'v3:bell-refresh' (מ-app/v3/notify/store.js אחרי שמירת הערה בפעמון) מרענן את המונה,
  // והרשימה אם הפעמון פתוח. תוספת בלבד - אותן קריאות API כמו בפולינג.
  useEffect(() => {
    const onRefresh = () => {
      fetchUnreadCount();
      if (isOpenRef.current) fetchNotifications();
    };
    window.addEventListener('v3:bell-refresh', onRefresh);
    return () => window.removeEventListener('v3:bell-refresh', onRefresh);
  }, [employeeId]);

  // פתיחת הפעמון (בריחוף/לחיצה/מקלדת) טוענת את הרשימה המלאה - כמו הכפתור הישן
  useEffect(() => {
    if (isOpen) fetchNotifications();
  }, [isOpen]);

  const markAsRead = async (id) => {
    try {
      const res = await fetch('/api/notifications/read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notificationId: id }),
      });
      if (res.ok) {
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
        setUnreadFromPoll(prev => Math.max(0, prev - 1));
      }
    } catch (err) {
      console.error(err);
    }
  };

  if (!employeeId) return null;

  // Mirror /messages's fetchData filtering: archived messages shouldn't inflate the badge/dropdown.
  const activeNotifications = notifications.filter(n => !n.isArchived);
  // כשהרשימה המלאה נטענה (הפעמון נפתח) היא מקור האמת; אחרת - המונה מהבדיקה הקלה.
  const unreadCount = notifications.length > 0
    ? activeNotifications.filter(n => !n.isRead).length
    : unreadFromPoll;

  const badgeText = unreadCount > 99 ? '99+' : String(unreadCount);

  return (
    <div {...itemProps}>
      <button
        type="button"
        {...triggerProps}
        className="v3-topbar__ib"
        aria-label={unreadCount > 0 ? `התראות, ${unreadCount} חדשות` : 'התראות'}
        title="התראות"
      >
        <Icon name="bell" />
        {unreadCount > 0 && <span className="v3-badge v3-topbar__badge" aria-hidden="true"><bdi>{badgeText}</bdi></span>}
      </button>

      <div className="v3-topbar__panel v3-tb-panel v3-tb-bell" role="dialog" aria-label="התראות">
        <div className="v3-panel-h">
          <strong>התראות (<bdi>{unreadCount}</bdi>)</strong>
          <Link href="/messages" onClick={() => closePanel(false)} className="v3-tb-linkbtn" data-tbl>
            <Icon name="mail" size="sm" />
            פתח מרכז הודעות
          </Link>
        </div>

        <div className="v3-tb-scroll">
          {activeNotifications.length === 0 ? (
            <div className="v3-tb-empty v3-tb-empty--ic">
              <Icon name="message" size="lg" />
              <p>אין הודעות חדשות</p>
            </div>
          ) : (
            activeNotifications.map((notif) => (
              <div key={notif.id} className={`v3-notif${notif.isRead ? '' : ' is-unread'}`}>
                <span className="v3-notif__ic" aria-hidden="true">
                  {notif.sender ? notif.sender.firstName.charAt(0) : 'מ'}
                </span>
                <div className="v3-notif__b">
                  <b>
                    {notif.sender ? `${notif.sender.firstName} ${notif.sender.lastName}` : 'מערכת'}
                    {notif.receiverId === null && <span className="v3-tag v3-tb-all-tag">לכולם</span>}
                  </b>
                  <span className="v3-notif__txt">{notif.content}</span>
                  <small>
                    <bdi>{new Date(notif.createdAt).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}</bdi>
                  </small>
                  {!notif.isRead && (
                    <button type="button" className="v3-tb-read" data-tbl onClick={() => markAsRead(notif.id)}>
                      <Icon name="check" size="sm" />
                      סמן כנקרא
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
