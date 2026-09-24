'use client';

import React, { useState } from 'react';
import { Dialog, Btn, Field, Seg, Banner } from '@/app/v3/ui/components';

export default function ModernSendEmailModal({ isOpen, onClose, customer, authResult }) {
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [files, setFiles] = useState([]);
  const [sendMode, setSendMode] = useState('email');
  const [driveFolderId, setDriveFolderId] = useState('');
  const [driveLinks, setDriveLinks] = useState([]);
  const [sentOk, setSentOk] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen || typeof document === 'undefined') return null;

  const fileToBase64 = (f) => new Promise((resolve, reject) => {
    const r = new FileReader();
    r.readAsDataURL(f);
    r.onload = () => resolve(String(r.result).split(',')[1] || '');
    r.onerror = reject;
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!subject.trim() || !body.trim()) {
      setError('חובה למלא נושא ותוכן');
      return;
    }

    setLoading(true);
    setError('');
    setSentOk('');
    setDriveLinks([]);

    try {
      const attachments = [];
      for (const f of files) {
        attachments.push({
          fileName: f.name,
          fileContent: await fileToBase64(f),
          mimeType: f.type || 'application/octet-stream',
          sizeBytes: f.size || null,
          dest: sendMode
        });
      }
      const res = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: customer.email,
          subject,
          emailBody: body,
          username: authResult.employeeId,
          password: authResult.pin,
          customerId: customer.id,
          fileName: attachments[0]?.fileName || '',
          fileContent: attachments[0]?.fileContent || '',
          attachments,
          sendMode,
          driveFolderId
        })
      });

      const data = await res.json();
      if (data.success) {
        const links = Array.isArray(data.driveLinks) ? data.driveLinks : [];
        setDriveLinks(links);
        setSentOk(links.length > 0 ? `המייל נשלח! ${links.length} קבצים בדרייב עם הרשאת הורדה מלאה.` : 'המייל נשלח בהצלחה!');
        setTimeout(() => {
          onClose();
          setSubject('');
          setBody('');
          setFiles([]);
          setSendMode('email');
          setDriveFolderId('');
          setSentOk('');
          setDriveLinks([]);
        }, 2400);
      } else {
        setError(data.message || 'שגיאה בשליחת המייל');
      }
    } catch (err) {
      console.error(err);
      setError('שגיאת תקשורת');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      open={isOpen}
      onClose={() => { if (!loading) onClose(); }}
      variant="form"
      icon="mail"
      title={`מייל ל${customer.firstName || ''} ${customer.lastName || ''}`.trim()}
      sub={customer.email ? `יישלח אל ${customer.email}` : undefined}
      actions={(
        <>
          <Btn type="submit" form="customer-email-form" variant="primary" icon="send" loading={loading}>
            {loading ? 'שולח...' : 'שליחה'}
          </Btn>
          <Btn variant="quiet" onClick={onClose} disabled={loading}>ביטול</Btn>
        </>
      )}
    >
      <form id="customer-email-form" onSubmit={handleSubmit} className="v3-stack">
        {error && <Banner kind="alert" title={error} />}
        {sentOk && (
          <Banner kind="success" title={sentOk} />
        )}
        {sentOk && driveLinks.length > 0 && (
          <ul>
            {driveLinks.map((l, i) => (
              <li key={i}>{l.url ? <a href={l.url} target="_blank" rel="noreferrer">{l.fileName || l.url}</a> : (l.fileName || '')}</li>
            ))}
          </ul>
        )}

        <Field
          label="נושא"
          type="text"
          value={subject}
          onChange={e => setSubject(e.target.value)}
          required
          disabled={loading}
        />

        <Field
          label="תוכן ההודעה"
          as="textarea"
          value={body}
          onChange={e => setBody(e.target.value)}
          rows={6}
          required
          disabled={loading}
        />

        <Field
          label="קבצים מצורפים"
          tip="אפשר לבחור כמה קבצים. טבלת הוראות מצורפת למייל אוטומטית."
          hint={files.length > 0 ? `נבחרו ${files.length} קבצים: ${files.map(f => f.name).join(', ')}` : undefined}
        >
          <input type="file" multiple onChange={e => setFiles(e.target.files ? Array.from(e.target.files) : [])} disabled={loading} />
        </Field>

        <div className="v3-field">
          <span className="v3-label">איך לשלוח את הקבצים</span>
          <Seg
            label="יעד הקבצים"
            value={sendMode}
            onChange={(v) => { if (!loading) setSendMode(v); }}
            options={[
              { value: 'email', label: 'צרופה למייל', icon: 'mail' },
              { value: 'drive', label: 'דרייב ושיתוף', icon: 'folder' },
              { value: 'both', label: 'שניהם', icon: 'copy' }
            ]}
          />
        </div>

        {(sendMode === 'drive' || sendMode === 'both') && (
          <Field
            label="תיקיית דרייב"
            hint="הנמען יקבל הרשאת הורדה מלאה לקבצים."
            type="text"
            value={driveFolderId}
            onChange={e => setDriveFolderId(e.target.value)}
            placeholder="מזהה תיקייה (לא חובה)"
            dir="ltr"
            disabled={loading}
          />
        )}
      </form>
    </Dialog>
  );
}
