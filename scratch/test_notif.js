const cookie = "auth_token=1";
fetch("http://localhost:3000/api/notifications", {
  headers: {
    "Cookie": cookie
  }
}).then(r => r.json()).then(console.log).catch(console.error);
