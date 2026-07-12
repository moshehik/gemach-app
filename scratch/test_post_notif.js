const cookie = "auth_token=1";
fetch("http://localhost:3000/api/notifications", {
  method: "POST",
  headers: {
    "Cookie": cookie,
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    receiverId: "all",
    content: "Test global message"
  })
}).then(r => r.json()).then(console.log).catch(console.error);
