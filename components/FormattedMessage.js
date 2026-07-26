import React from 'react';
import Link from 'next/link';

export default function FormattedMessage({ content }) {
  if (!content || typeof content !== 'string') return <>{content}</>;
  
  // Match patterns like "הזמנה 123", "הזמנה מספר 123", "הזמנה מס' 123"
  const regex = /(הזמנה\s+(?:מספר\s+|מס'\s+)?)(\d+)/g;
  const parts = [];
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      parts.push(content.substring(lastIndex, match.index));
    }
    const orderId = match[2];
    const prefix = match[1];
    parts.push(
      <Link 
        key={match.index} 
        href={`/orders/${orderId}`} 
        style={{ color: '#2563eb', textDecoration: 'underline', fontWeight: '600' }}
        target="_blank"
      >
        {prefix}{orderId}
      </Link>
    );
    lastIndex = regex.lastIndex;
  }
  
  if (lastIndex < content.length) {
    parts.push(content.substring(lastIndex));
  }

  return <>{parts.length > 0 ? parts : content}</>;
}
