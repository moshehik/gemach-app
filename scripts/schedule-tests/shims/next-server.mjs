export const NextResponse = {
  json(body, init) {
    return { status: (init && init.status) || 200, headers: (init && init.headers) || {}, __json: body, json: async () => body };
  },
};
