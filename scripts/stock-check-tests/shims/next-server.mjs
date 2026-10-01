export class NextResponse {
  static json(body, init) { return { __json: body, status: (init && init.status) || 200, ok: !init || !init.status || init.status < 400, json: async () => body }; }
}
