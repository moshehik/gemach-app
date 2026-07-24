<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

### ID Display Rules
When generating links, references, or speaking to the user about entities (Orders, Customers, Dress Models, etc.), ALWAYS use the short human-readable ID (e.g., orderId, legacyId, arcodePrefix). NEVER expose or use the id (UUID) field for display purposes. For URLs, orderId works for /orders/, but /customers/ requires the UUID id.
