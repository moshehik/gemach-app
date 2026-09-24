'use client';
// V3Stepper (STEPPER-PATTERNS): ציר זמן צמתים של סקיצה B + עוגן "שלב X מתוך N" + פס התקדמות + פוטר ניווט.
import Icon from './Icon';
import Btn from './Btn';
import Tip from './Tip';
import { cx } from './cx';

/**
 * Stepper: steps=[{key,label,value?,icon?,locked?,lockedReason?}] · current (אינדקס 0..N-1) · onStep(index)
 * showAnchor => "שלב X מתוך N" + פס התקדמות · צומת נעול מציג lockedReason ב-Tip (לא alert).
 * done = navy + וי · cur = זהב-טבעת (aria-current="step") · fut = לבן.
 */
export function Stepper({ steps, current, onStep, showAnchor = true, label = 'שלבי התהליך', className }) {
  const n = steps.length;
  const pct = n > 1 ? Math.round((current / (n - 1)) * 100) : 100;
  return (
    <div className={className}>
      <nav aria-label={label}>
        <div className="v3-timeline">
          <ol className="v3-timeline__nodes" style={{ '--n': n }}>
            {steps.map((s, i) => {
              const st = i < current ? 'done' : i === current ? 'cur' : 'fut';
              const locked = s.locked && i !== current;
              const dot = (
                <>
                  {s.icon ? <Icon name={s.icon} /> : <bdi className="v3-tl-num">{i + 1}</bdi>}
                  {st === 'done' && <span className="v3-tl-check"><Icon name="check" anim={false} /></span>}
                </>
              );
              const dotProps = { className: 'v3-tl-dot', 'aria-current': st === 'cur' ? 'step' : undefined };
              let node;
              if (onStep && !locked) node = <button type="button" {...dotProps} onClick={() => onStep(i)} aria-label={`${s.label}, שלב ${i + 1} מתוך ${n}`}>{dot}</button>;
              else if (locked && s.lockedReason) node = <Tip content={s.lockedReason}><span {...dotProps} role="button" aria-disabled="true" aria-label={`${s.label} (נעול)`}>{dot}</span></Tip>;
              else node = <span {...dotProps}>{dot}</span>;
              return (
                <li key={s.key} className={cx('v3-tl-node', `is-${st}`)} style={{ '--fill': st === 'done' ? 1 : st === 'cur' ? 0.4 : 0 }}>
                  {node}
                  <div className="v3-tl-label"><b>{s.label}</b>{s.value != null && <span>{s.value}</span>}</div>
                </li>
              );
            })}
          </ol>
        </div>
      </nav>
      {showAnchor && (
        <div className="v3-stepper__anchor">
          <span className="v3-muted v3-text-sm" aria-live="polite">שלב <bdi>{current + 1}</bdi> מתוך <bdi>{n}</bdi></span>
          <div className="v3-progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label="התקדמות"><i style={{ width: `${pct}%` }} /></div>
        </div>
      )}
    </div>
  );
}

/** פוטר ניווט: המשך (ראשי, תחילת שורה) · חזרה (שקט, סוף שורה). nextTip = ⓘ שמסביר למה המשך חסום. */
export function StepNav({ onBack, onNext, backLabel = 'חזרה', nextLabel = 'להמשך', nextDisabled, nextTip, nextLoading, className }) {
  return (
    <div className={cx('v3-stepnav', className)}>
      <div className="v3-cluster">
        <Btn variant="primary" iconEnd="next" onClick={onNext} disabled={nextDisabled} loading={nextLoading}>{nextLabel}</Btn>
        {nextDisabled && nextTip && <Tip>{nextTip}</Tip>}
      </div>
      {onBack && <Btn variant="quiet" icon="back" onClick={onBack}>{backLabel}</Btn>}
    </div>
  );
}

/** Timeline: יומן אירועים אנכי. events=[{key?,icon,title,sub?,time?}] */
export function Timeline({ events, className }) {
  return (
    <ol className={cx('v3-vtl', className)}>
      {events.map((e, i) => (
        <li key={e.key ?? i} className="v3-vtl__e">
          <span className="v3-vtl__p"><Icon name={e.icon || 'clock'} /></span>
          <div>
            <b>{e.title}</b>
            {e.sub && <div className="v3-muted v3-text-sm">{e.sub}</div>}
            {e.time && <div className="v3-faint v3-text-sm"><bdi>{e.time}</bdi></div>}
          </div>
        </li>
      ))}
    </ol>
  );
}
export default Stepper;
