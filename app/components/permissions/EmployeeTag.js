'use client';

// Modern pill for a specific employee with access to a permission row — initials
// avatar + name, info-tinted so it reads differently from a department's
// badge-primary. Used in /admin/permissions' "מי מורשה" column (read-only) and in
// PermissionRowWizard's employee step (with onRemove).
export function employeeDisplayName(emp) {
  return [emp?.lastName, emp?.firstName].filter(Boolean).join(' ') || emp?.id || '';
}

export default function EmployeeTag({ employee, onRemove, disabled }) {
  const name = employeeDisplayName(employee);
  const initial = (employee?.firstName || employee?.lastName || name || '?').trim().charAt(0);

  return (
    <span
      title={employee?.department?.name ? `${name} — ${employee.department.name}` : name}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: '6px',
        padding: '2px 10px 2px 3px', borderRadius: 'var(--radius-full)',
        background: 'var(--info-tint)', color: 'var(--info)',
        fontSize: '12px', fontWeight: 600, lineHeight: 1.4,
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: '20px', height: '20px', borderRadius: '50%', flex: '0 0 auto',
          background: 'var(--info)', color: 'var(--surface, #fff)',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '11px', fontWeight: 700,
        }}
      >
        {initial}
      </span>
      {name}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          disabled={disabled}
          title="הסר עובד"
          aria-label="הסר עובד"
          style={{ display: 'inline-flex', border: 'none', background: 'none', cursor: disabled ? 'default' : 'pointer', color: 'inherit', padding: 0, opacity: 0.7 }}
        >
          <svg className="icon" style={{ width: '11px', height: '11px' }}><use href="#i-x" /></svg>
        </button>
      )}
    </span>
  );
}
