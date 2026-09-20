export class NextResponse {
  static json(body, init) { return { __json: body, status: (init && init.status) || 200 }; }
}
