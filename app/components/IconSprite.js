// "אריג" icon sprite — canonical source: scratch/design-v2/assets/icons.svg (62 symbols).
// Rendered once in app/layout.js; every page references a symbol via
// <svg className="icon"><use href="#i-name" /></svg>.
export default function IconSprite() {
  return (
    <svg style={{ display: 'none' }} aria-hidden="true">
      <defs>
        <symbol id="i-home" viewBox="0 0 24 24"><path d="M4 11.5 12 4l8 7.5" /><path d="M6 10v9a1 1 0 0 0 1 1h4v-6h2v6h4a1 1 0 0 0 1-1v-9" /></symbol>
        <symbol id="i-grid" viewBox="0 0 24 24"><rect x="4" y="4" width="7" height="7" rx="1.5" /><rect x="13" y="4" width="7" height="7" rx="1.5" /><rect x="4" y="13" width="7" height="7" rx="1.5" /><rect x="13" y="13" width="7" height="7" rx="1.5" /></symbol>
        <symbol id="i-bag" viewBox="0 0 24 24"><path d="M7 8V6a5 5 0 0 1 10 0v2" /><rect x="4" y="8" width="16" height="12" rx="2" /></symbol>
        <symbol id="i-users" viewBox="0 0 24 24"><circle cx="9" cy="8" r="3.2" /><path d="M3.5 20c0-3.3 2.6-6 6-6s6 2.7 6 6" /><path d="M16 6.5a3.2 3.2 0 0 1 0 6.3" /><path d="M20.5 20c0-2.7-1.7-5-4-5.7" /></symbol>
        <symbol id="i-user" viewBox="0 0 24 24"><circle cx="12" cy="8" r="3.5" /><path d="M4.5 20c0-4 3.4-7 7.5-7s7.5 3 7.5 7" /></symbol>
        <symbol id="i-user-check" viewBox="0 0 24 24"><circle cx="10" cy="8" r="3.5" /><path d="M3.5 20c0-4 3-7 6.5-7s6.5 3 6.5 7" /><path d="m16 12 2 2 3-3.5" /></symbol>
        <symbol id="i-calendar" viewBox="0 0 24 24"><rect x="4" y="5.5" width="16" height="14.5" rx="2" /><path d="M8 3.5v4M16 3.5v4M4 10h16" /></symbol>
        <symbol id="i-clock" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.3" /><path d="M12 7.5V12l3.2 2" /></symbol>
        <symbol id="i-card" viewBox="0 0 24 24"><rect x="3.5" y="5.5" width="17" height="13" rx="2" /><path d="M3.5 9.8h17" /><path d="M7 15h4" /></symbol>
        <symbol id="i-coin" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.3" /><path d="M12 7.5v9M9.3 9.3c0-1.1 1.1-2 2.7-2s2.7.9 2.7 2c0 2.7-5.4 1.3-5.4 4 0 1.1 1.1 2 2.7 2s2.7-.9 2.7-2" /></symbol>
        <symbol id="i-printer" viewBox="0 0 24 24"><path d="M6.5 9V4.5h11V9" /><rect x="3.5" y="9" width="17" height="7.5" rx="1.8" /><rect x="6.5" y="13.5" width="11" height="6" rx="1" /></symbol>
        <symbol id="i-settings" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3" /><path d="M12 3.5v2.2M12 18.3v2.2M20.5 12h-2.2M5.7 12H3.5M17.7 6.3l-1.5 1.5M7.8 16.2l-1.5 1.5M17.7 17.7l-1.5-1.5M7.8 7.8 6.3 6.3" /></symbol>
        <symbol id="i-search" viewBox="0 0 24 24"><circle cx="10.5" cy="10.5" r="6.5" /><path d="m20 20-4.8-4.8" /></symbol>
        <symbol id="i-edit" viewBox="0 0 24 24"><path d="M16.5 4.5 19.5 7.5 8 19H5v-3z" /></symbol>
        <symbol id="i-trash" viewBox="0 0 24 24"><path d="M5 7h14M9.5 7V5a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v2M18 7l-.8 12a2 2 0 0 1-2 1.9H8.8a2 2 0 0 1-2-1.9L6 7" /></symbol>
        <symbol id="i-plus" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" /></symbol>
        <symbol id="i-check" viewBox="0 0 24 24"><path d="m5 12.5 4.5 4.5L19 7.5" /></symbol>
        <symbol id="i-x" viewBox="0 0 24 24"><path d="m6 6 12 12M18 6 6 18" /></symbol>
        <symbol id="i-chevron-down" viewBox="0 0 24 24"><path d="m6 9.5 6 6 6-6" /></symbol>
        <symbol id="i-chevron-start" viewBox="0 0 24 24"><path d="m15 6-6 6 6 6" /></symbol>
        <symbol id="i-chevron-end" viewBox="0 0 24 24"><path d="m9 6 6 6-6 6" /></symbol>
        <symbol id="i-bell" viewBox="0 0 24 24"><path d="M6 10a6 6 0 0 1 12 0c0 4.5 1.5 6 1.5 6h-15S6 14.5 6 10Z" /><path d="M10 19a2 2 0 0 0 4 0" /></symbol>
        <symbol id="i-message" viewBox="0 0 24 24"><path d="M4 5.5h16v11H9l-4 3.5v-3.5H4Z" /></symbol>
        <symbol id="i-mic" viewBox="0 0 24 24"><rect x="9" y="3.5" width="6" height="11" rx="3" /><path d="M6 11a6 6 0 0 0 12 0" /><path d="M12 17v3.5M9 20.5h6" /></symbol>
        <symbol id="i-alert-tri" viewBox="0 0 24 24"><path d="M12 4.5 21 19H3Z" /><path d="M12 10v4M12 16.5v.1" /></symbol>
        <symbol id="i-alert-circle" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.3" /><path d="M12 7.5v5.5M12 16v.1" /></symbol>
        <symbol id="i-check-circle" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.3" /><path d="m8.3 12.3 2.6 2.6 4.8-5.6" /></symbol>
        <symbol id="i-x-circle" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.3" /><path d="m9.3 9.3 5.4 5.4M14.7 9.3l-5.4 5.4" /></symbol>
        <symbol id="i-info" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.3" /><path d="M12 11v5.5M12 7.7v.1" /></symbol>
        <symbol id="i-lock" viewBox="0 0 24 24"><rect x="5.5" y="10.5" width="13" height="9" rx="2" /><path d="M8.5 10.5V7.5a3.5 3.5 0 0 1 7 0v3" /></symbol>
        <symbol id="i-upload" viewBox="0 0 24 24"><path d="M12 15.5V4.5M8 8.5l4-4 4 4" /><path d="M4.5 15.5v3a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-3" /></symbol>
        <symbol id="i-download" viewBox="0 0 24 24"><path d="M12 4.5v11M8 12l4 4 4-4" /><path d="M4.5 16.5v3a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-3" /></symbol>
        <symbol id="i-refresh" viewBox="0 0 24 24"><path d="M4.5 12a7.5 7.5 0 0 1 12.6-5.5L19.5 8" /><path d="M19.5 12a7.5 7.5 0 0 1-12.6 5.5L4.5 16" /><path d="M19.5 4.5V8H16M4.5 19.5V16H8" /></symbol>
        <symbol id="i-eye" viewBox="0 0 24 24"><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" /><circle cx="12" cy="12" r="2.6" /></symbol>
        <symbol id="i-menu" viewBox="0 0 24 24"><path d="M4 6.5h16M4 12h16M4 17.5h16" /></symbol>
        <symbol id="i-tag" viewBox="0 0 24 24"><path d="M11.5 4.5H6a1.5 1.5 0 0 0-1.5 1.5v5.5L14 21l6-6-9.5-10Z" /><circle cx="9" cy="9" r="1.4" /></symbol>
        <symbol id="i-box" viewBox="0 0 24 24"><path d="m4 8 8-4 8 4-8 4-8-4Z" /><path d="M4 8v8l8 4 8-4V8" /><path d="M12 12v8" /></symbol>
        <symbol id="i-phone" viewBox="0 0 24 24"><path d="M6 3.5h3l1.5 4-2 1.5a12 12 0 0 0 5.5 5.5l1.5-2 4 1.5v3a1.5 1.5 0 0 1-1.6 1.5A16 16 0 0 1 4.5 5.1 1.5 1.5 0 0 1 6 3.5Z" /></symbol>
        <symbol id="i-mail" viewBox="0 0 24 24"><rect x="3.5" y="5.5" width="17" height="13" rx="2" /><path d="m4 6.5 8 6.5 8-6.5" /></symbol>
        <symbol id="i-pin" viewBox="0 0 24 24"><path d="M12 21s7-6.5 7-12a7 7 0 0 0-14 0c0 5.5 7 12 7 12Z" /><circle cx="12" cy="9" r="2.4" /></symbol>
        <symbol id="i-thumbtack" viewBox="0 0 24 24"><path d="M9 4h6M9 4v3.3c0 1-.9 1.4-1.4 2.3C6.9 11 6.5 12.4 6.5 13.5h11c0-1.1-.4-2.5-1.1-3.9-.5-.9-1.4-1.3-1.4-2.3V4" /><path d="M12 13.5V21" /></symbol>
        <symbol id="i-star" viewBox="0 0 24 24"><path d="m12 4 2.5 5.4 5.8.6-4.4 4 1.3 5.8L12 16.9 6.8 19.8l1.3-5.8-4.4-4 5.8-.6Z" /></symbol>
        <symbol id="i-sort" viewBox="0 0 24 24"><path d="M7 4.5v15M4 7.5l3-3 3 3" /><path d="M17 19.5v-15M14 16.5l3 3 3-3" /></symbol>
        <symbol id="i-more" viewBox="0 0 24 24"><circle cx="5.5" cy="12" r="1.4" /><circle cx="12" cy="12" r="1.4" /><circle cx="18.5" cy="12" r="1.4" /></symbol>
        <symbol id="i-file" viewBox="0 0 24 24"><path d="M7 3.5h7l4 4v13H7Z" /><path d="M14 3.5V8h4" /></symbol>
        <symbol id="i-folder" viewBox="0 0 24 24"><path d="M4 6.5h5.5L11 8.5h9v9.7a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18.2Z" /></symbol>
        <symbol id="i-database" viewBox="0 0 24 24"><ellipse cx="12" cy="6" rx="7.5" ry="2.8" /><path d="M4.5 6v12c0 1.5 3.4 2.8 7.5 2.8s7.5-1.3 7.5-2.8V6" /><path d="M4.5 12c0 1.5 3.4 2.8 7.5 2.8s7.5-1.3 7.5-2.8" /></symbol>
        <symbol id="i-shield" viewBox="0 0 24 24"><path d="M12 3.5 19 6v6c0 5-3 7.8-7 8.5-4-.7-7-3.5-7-8.5V6Z" /><path d="m8.7 12 2.3 2.3 4.3-4.6" /></symbol>
        <symbol id="i-activity" viewBox="0 0 24 24"><path d="M3.5 12h4l2.2-7 4.6 14 2-7h4" /></symbol>
        <symbol id="i-camera" viewBox="0 0 24 24"><path d="M4 8.5h3l1.5-2h7l1.5 2h3v10H4Z" /><circle cx="12" cy="13.3" r="3.3" /></symbol>
        <symbol id="i-logout" viewBox="0 0 24 24"><path d="M9 4.5H6a1.5 1.5 0 0 0-1.5 1.5v12A1.5 1.5 0 0 0 6 19.5h3" /><path d="M14 8l4 4-4 4M18 12H9" /></symbol>
        <symbol id="i-history" viewBox="0 0 24 24"><path d="M4.5 12a7.5 7.5 0 1 0 2.3-5.4" /><path d="M3.5 4v4h4" /><path d="M12 8v4.5l3 2" /></symbol>
        <symbol id="i-scissors" viewBox="0 0 24 24"><circle cx="6.5" cy="6.5" r="2.3" /><circle cx="6.5" cy="17.5" r="2.3" /><path d="m20 5-13 13M8.3 8.3 20 19" /></symbol>
        <symbol id="i-id" viewBox="0 0 24 24"><rect x="3.5" y="5.5" width="17" height="13" rx="2" /><circle cx="9" cy="11" r="2" /><path d="M6.5 16c.5-1.8 1.8-2.6 2.5-2.6s2 .8 2.5 2.6M14.5 10h4M14.5 13.5h4" /></symbol>
        <symbol id="i-wallet" viewBox="0 0 24 24"><path d="M4 7.5A1.5 1.5 0 0 1 5.5 6h13A1.5 1.5 0 0 1 20 7.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 16.5Z" /><path d="M15.5 12.5h2.3M4 10.5h16" /></symbol>
        <symbol id="i-receipt" viewBox="0 0 24 24"><path d="M6 3.5h12v17l-2.2-1.5-2 1.5-1.8-1.5-2 1.5-1.8-1.5L6 20.5Z" /><path d="M8.5 8h7M8.5 11.5h7M8.5 15h4" /></symbol>
        <symbol id="i-truck" viewBox="0 0 24 24"><path d="M3.5 7h10v9h-10Z" /><path d="M13.5 10.5H17l3 3v2.5h-2.5" /><circle cx="7" cy="18" r="1.7" /><circle cx="16.5" cy="18" r="1.7" /></symbol>
        <symbol id="i-link" viewBox="0 0 24 24"><path d="M9.5 14.5 14.5 9.5" /><path d="M11 7l1.5-1.5a3 3 0 0 1 4.2 4.2L15 11.5" /><path d="M13 17l-1.5 1.5a3 3 0 0 1-4.2-4.2L9 12.5" /></symbol>
        <symbol id="i-image" viewBox="0 0 24 24"><rect x="3.5" y="4.5" width="17" height="15" rx="2" /><circle cx="9" cy="10" r="1.6" /><path d="m5 17 5-5 3.5 3.5L18 11l2.5 2.5" /></symbol>
        <symbol id="i-play" viewBox="0 0 24 24"><path d="M7 5.5v13l11-6.5Z" /></symbol>
        <symbol id="i-arrow-end" viewBox="0 0 24 24"><path d="M4 12h16M13 6l6 6-6 6" /></symbol>
        <symbol id="i-list" viewBox="0 0 24 24"><circle cx="4.5" cy="6.5" r="1" /><circle cx="4.5" cy="12" r="1" /><circle cx="4.5" cy="17.5" r="1" /><path d="M9 6.5h11M9 12h11M9 17.5h11" /></symbol>
        <symbol id="i-expand" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.3" /><path d="m8.3 10.3 3.7 3.7 3.7-3.7" /></symbol>
        <symbol id="i-category" viewBox="0 0 24 24"><path d="M12 3.5 3.5 8l8.5 4.5L20.5 8Z" /><path d="m3.5 12 8.5 4.5L20.5 12" /><path d="m3.5 16 8.5 4.5L20.5 16" /></symbol>
        <symbol id="i-copy" viewBox="0 0 24 24"><rect x="8.5" y="8.5" width="11.5" height="11.5" rx="2" /><path d="M15.5 8.5V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v7.5a2 2 0 0 0 2 2h2.5" /></symbol>
        <symbol id="i-archive" viewBox="0 0 24 24"><rect x="3.5" y="4.5" width="17" height="4" rx="1" /><path d="M4.5 8.5v9a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-9" /><path d="M10 13h4" /></symbol>
      </defs>
    </svg>
  );
}
