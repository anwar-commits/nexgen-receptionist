import { createServer } from "node:http";
import { createApp } from "./app.js";
import { config } from "./config.js";
import { initRealtime } from "./lib/realtime.js";
import { startReminderJob } from "./services/reminders.js";

const app = createApp();
const server = createServer(app);
initRealtime(server);
startReminderJob();

server.listen(config.PORT, () => {
  console.log(`NexGen receptionist API listening on :${config.PORT}`);
});
