'use client';
import { useState, useEffect, useRef } from 'react';
import { Bell, Check, MessageSquare, Plus, Mail } from 'lucide-react';
import Link from 'next/link';

export default function NotificationBell({ employeeId }) {
  const [notifications, setNotifications] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef(null);

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
    // Poll every minute
    const interval = setInterval(fetchNotifications, 60000);
    return () => clearInterval(interval);
  }, [employeeId]);

  useEffect(() => {
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuRef]);

  const markAsRead = async (id) => {
    try {
      const res = await fetch('/api/notifications/read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notificationId: id })
      });
      if (res.ok) {
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
      }
    } catch (err) {
      console.error(err);
    }
  };

  if (!employeeId) return null;

  const unreadCount = notifications.filter(n => !n.isRead).length;

  return (
    <div style={{ position: 'relative' }} ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '36px',
          height: '36px',
          borderRadius: '50%',
          color: 'var(--text-color)',
          transition: 'background 0.2s'
        }}
        className="hover:bg-gray-100 dark:hover:bg-gray-800"
      >
        <Bell size={22} />
        {unreadCount > 0 && (
          <span style={{
            position: 'absolute',
            top: '0',
            right: '0',
            background: '#ef4444',
            color: 'white',
            fontSize: '0.7rem',
            fontWeight: 'bold',
            borderRadius: '50%',
            width: '16px',
            height: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div style={{
          position: 'absolute',
          top: 'calc(100% + 8px)',
          left: 0,
          width: '350px',
          background: 'var(--card-bg)',
          borderRadius: '16px',
          boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
          border: '1px solid var(--border-color)',
          overflow: 'hidden',
          zIndex: 50,
          display: 'flex',
          flexDirection: 'column'
        }}>
          <div style={{ padding: '1rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0, fontSize: '1rem', color: 'var(--text-color)' }}>התראות ({unreadCount})</h3>
            <Link 
              href="/messages"
              onClick={() => setIsOpen(false)}
              style={{ background: '#eff6ff', color: '#2563eb', border: 'none', padding: '0.4rem 0.6rem', borderRadius: '6px', fontSize: '0.8rem', fontWeight: '500', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem', textDecoration: 'none' }}
            >
              <Mail size={14} /> פתח מרכז הודעות
            </Link>
          </div>
          
          <div style={{ maxHeight: '350px', overflowY: 'auto' }}>
            {notifications.length === 0 ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b', fontSize: '0.9rem' }}>
                <MessageSquare size={32} style={{ opacity: 0.2, margin: '0 auto 0.5rem' }} />
                אין הודעות חדשות
              </div>
            ) : (
              notifications.map((notif) => (
                <div key={notif.id} style={{
                  padding: '1rem',
                  borderBottom: '1px solid var(--border-color)',
                  background: notif.isRead ? 'transparent' : 'rgba(59, 130, 246, 0.05)',
                  display: 'flex',
                  gap: '0.75rem',
                  transition: 'background 0.2s'
                }}>
                  <div style={{
                    width: '32px', height: '32px', borderRadius: '50%', background: notif.receiverId ? '#2563eb' : '#10b981', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '0.8rem'
                  }}>
                    {notif.sender ? notif.sender.firstName.charAt(0) : 'מ'}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.25rem' }}>
                      <span style={{ fontWeight: '600', fontSize: '0.9rem', color: 'var(--text-color)' }}>
                        {notif.sender ? `${notif.sender.firstName} ${notif.sender.lastName}` : 'מערכת'}
                        {notif.receiverId === null && <span style={{ background: '#f1f5f9', color: '#64748b', fontSize: '0.7rem', padding: '0.1rem 0.4rem', borderRadius: '4px', marginRight: '0.5rem' }}>לכולם</span>}
                      </span>
                      <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                        {new Date(notif.createdAt).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-color)', marginBottom: '0.5rem', whiteSpace: 'pre-wrap' }}>
                      {notif.content}
                    </div>
                    {!notif.isRead && (
                      <button
                        onClick={() => markAsRead(notif.id)}
                        style={{ background: 'transparent', border: 'none', color: '#3b82f6', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.25rem', cursor: 'pointer', padding: 0 }}
                      >
                        <Check size={14} /> סמן כנקרא
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
