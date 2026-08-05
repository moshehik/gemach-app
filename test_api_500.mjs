import { GET } from './app/api/orders/[id]/route.js';

async function main() {
  const req = new Request('http://localhost:3000/api/orders/25734');
  try {
    const res = await GET(req, { params: Promise.resolve({ id: '25734' }) });
    const text = await res.text();
    console.log("STATUS:", res.status);
    if (res.status === 500) {
      console.log("500 Response Body:", text);
    }
  } catch (err) {
    console.error("Caught error:", err);
  }
}

main();
