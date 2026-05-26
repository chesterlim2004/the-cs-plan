import { env } from "../config/env.js";

interface GoogleTokenResponse {
  access_token: string;
  id_token: string;
}

export interface GoogleUserInfo {
  sub: string;
  email: string;
  name: string;
  picture?: string;
}

export function buildGoogleAuthUrl(): string {
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", env.googleClientId);
  url.searchParams.set("redirect_uri", `${env.serverUrl}/api/auth/google/callback`);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("prompt", "select_account");
  return url.toString();
}

export async function exchangeCodeForGoogleUser(code: string): Promise<GoogleUserInfo> {
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: env.googleClientId,
      client_secret: env.googleClientSecret,
      redirect_uri: `${env.serverUrl}/api/auth/google/callback`,
      grant_type: "authorization_code"
    })
  });

  if (!tokenResponse.ok) {
    throw new Error("Failed to exchange Google OAuth code");
  }

  const tokens = (await tokenResponse.json()) as GoogleTokenResponse;
  const userResponse = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: { Authorization: `Bearer ${tokens.access_token}` }
  });

  if (!userResponse.ok) {
    throw new Error("Failed to fetch Google user info");
  }

  return userResponse.json() as Promise<GoogleUserInfo>;
}
