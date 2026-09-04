'use client';
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function NotificationBell({ employeeId }) {
  const [notifications, setNotifications] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef(null);
  const pathname = usePathname();

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

  useEffect(() => {
    fetchNotifications();
    let interval = null;
    const startPolling = () => {
      if (interval) return;
      interval = setInterval(fetchNotifications, 60000);
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
        fetchNotifications();
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
    fetchNotifications();
  }, [pathname]);

  useEffect(() => {
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    function handleEscape(event) {
      if (event.key === 'Escape') setIsOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [menuRef]);

  const markAsRead = async (id) => {
    try {
      const res = await fetch('/api/notifications/read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notificationId: id }),
      });
      if (res.ok) {
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
      }
    } catch (err) {
      console.error(err);
    }
  };

  if (!employeeId) return null;

  // Mirror /messages's fetchData filtering: archived messages shouldn't inflate the badge/dropdown.
  const activeNotifications = notifications.filter(n => !n.isArchived);
  const unreadCount = activeNotifications.filter(n => !n.isRead).length;

  return (
    <div style={{ position: 'relative' }} ref={menuRef}>
      <button type="button" className="icon-btn" onClick={() => { if (!isOpen) fetchNotifications(); setIsOpen(!isOpen); }} title="התראות">
        <svg className="icon"><use href="#i-bell" /></svg>
        {unreadCount > 0 && <span className="dot" />}
      </button>

      {isOpen && (
        <div className="user-menu-dropdown" style={{ minWidth: 340, maxWidth: 380, padding: 0, display: 'block' }}>
          <div className="modal-head" style={{ padding: '12px 16px' }}>
            <strong>התראות ({unreadCount})</strong>
            <Link href="/messages" onClick={() => setIsOpen(false)} className="btn btn-secondary btn-sm">
              <svg className="icon"><use href="#i-mail" /></svg>
              פתח מרכז הודעות
            </Link>
          </div>

          <div style={{ maxHeight: 350, overflowY: 'auto' }}>
            {activeNotifications.length === 0 ? (
              <div className="empty-state">
                <svg className="icon"><use href="#i-message" /></svg>
                <p>אין הודעות חדשות</p>
              </div>
            ) : (
              activeNotifications.map((notif) => (
                <div
                  key={notif.id}
                  className="skeleton-row"
                  style={{ background: notif.isRead ? 'transparent' : 'var(--primary-tint)', alignItems: 'flex-start' }}
                >
                  <div className="avatar" style={{ background: notif.receiverId ? 'var(--info-tint)' : 'var(--success-tint)', color: notif.receiverId ? 'var(--info)' : 'var(--success)' }}>
                    {notif.sender ? notif.sender.firstName.charAt(0) : 'מ'}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                      <span style={{ fontWeight: 700, fontSize: '13px' }}>
                        {notif.sender ? `${notif.sender.firstName} ${notif.sender.lastName}` : 'מערכת'}
                        {notif.receiverId === null && <span className="badge badge-neutral" style={{ marginInlineStart: 6 }}>לכולם</span>}
                      </span>
                      <span style={{ fontSize: '11px', color: 'var(--text-3)' }}>
                        {new Date(notif.createdAt).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <div style={{ fontSize: '12.5px', color: 'var(--text-2)', marginBottom: 6, whiteSpace: 'pre-wrap' }}>
                      {notif.content}
                    </div>
                    {!notif.isRead && (
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => markAsRead(notif.id)} style={{ padding: '2px 6px' }}>
                        <svg className="icon"><use href="#i-check" /></svg>
                        סמן כנקרא
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
