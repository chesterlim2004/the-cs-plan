import { connectDb } from "./config/db.js";
import { assertServerEnv, env } from "./config/env.js";
import { createApp } from "./app.js";

assertServerEnv();
await connectDb();

const app = createApp();
app.listen(env.port, () => {
  console.log(`API listening on ${env.serverUrl}`);
});
