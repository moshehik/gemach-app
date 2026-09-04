import { NextResponse } from 'next/server';

// Forwards the request pathname as a header so app/layout.js (a server component,
// with no other way to know the current route) can exempt the customer-facing
// kiosk (/customer-interface) from the global require_login wall - see the
// showLogin computation there. The kiosk has its own separate lock/unlock
// mechanism (see KIOSK.md) and must stay reachable without an employee login.
export function middleware(request) {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-pathname', request.nextUrl.pathname);
  return NextResponse.next({ request: { headers: requestHeaders } });
}

// x-pathname is only read by app/layout.js for page renders (the customer-interface
// kiosk exemption) - API routes and static assets never look at it, so skip them here
// to cut Edge Middleware invocations (this used to run on every polling API call too).
export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)'],
};
