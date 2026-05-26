import mongoose from "mongoose";
import { env } from "./env.js";

export async function connectDb(): Promise<void> {
  if (mongoose.connection.readyState === 1) {
    return;
  }

  await mongoose.connect(env.mongoUri);
}
