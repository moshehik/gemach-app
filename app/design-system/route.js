import { NextResponse } from 'next/server';

// /design-system -> the static palette page public/design-system/index.html ("מערכת העיצוב", see
// design-system/README.md). Next serves public/ files by exact path only (no directory index), so
// without this handler the short URL used by the admin tile and the docs would 404. The page itself
// stays a plain static file: it is self-contained (its own CSS, sprite and script) and must NOT be
// rendered inside the app layout, whose legacy CSS would restyle the palette's .btn/.card/.chip.
export function GET(request) {
  return NextResponse.redirect(new URL('/design-system/index.html', request.url), 308);
}
