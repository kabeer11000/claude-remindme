self.addEventListener("push", (event) => {
  let payload = { title: "Claude RemindMe", body: "Your AI sent a notification." };
  try {
    payload = { ...payload, ...event.data.json() };
  } catch {
    // ignore malformed payloads, fall back to defaults
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: "/icon.svg",
      badge: "/icon.svg",
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: "window" }).then((clients) => {
      if (clients.length > 0) return clients[0].focus();
      return self.clients.openWindow("/dashboard");
    })
  );
});
