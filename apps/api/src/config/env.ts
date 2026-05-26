import dotenv from "dotenv";

dotenv.config();

export const env = {
  port: Number(process.env.PORT ?? 4000),
  nodeEnv: process.env.NODE_ENV ?? "development",
  mongoUri: process.env.MONGODB_URI ?? "",
  clientUrl: process.env.CLIENT_URL ?? "http://localhost:5173",
  serverUrl: process.env.SERVER_URL ?? "http://localhost:4000",
  sessionSecret: process.env.SESSION_SECRET ?? "dev-session-secret-change-me",
  googleClientId: process.env.GOOGLE_CLIENT_ID ?? "",
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET ?? ""
};

export function assertServerEnv(): void {
  const missing = [
    ["MONGODB_URI", env.mongoUri],
    ["SESSION_SECRET", env.sessionSecret],
    ["GOOGLE_CLIENT_ID", env.googleClientId],
    ["GOOGLE_CLIENT_SECRET", env.googleClientSecret]
  ].filter(([, value]) => !value);

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.map(([key]) => key).join(", ")}`);
  }
}
