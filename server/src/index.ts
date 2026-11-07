import { createServer } from "node:http";
import { createApp } from "./app.js";
import { config } from "./config.js";
import { initRealtime } from "./lib/realtime.js";
import { startReminderJob } from "./services/reminders.js";

const app = createApp();

// Vercel runs the app as a serverless function, which can't hold sockets open
// or run background timers, so these only start on a long-running server.
if (!process.env.VERCEL) {
  const server = createServer(app);
  initRealtime(server);
  startReminderJob();

  server.listen(config.PORT, () => {
    console.log(`NexGen receptionist API listening on :${config.PORT}`);
  });
}

export default app;
