import { UserModel } from "../models/User.js";
import type { GoogleUserInfo } from "./googleAuthService.js";

export async function upsertGoogleUser(googleUser: GoogleUserInfo) {
  return UserModel.findOneAndUpdate(
    { googleId: googleUser.sub },
    {
      googleId: googleUser.sub,
      email: googleUser.email,
      name: googleUser.name,
      avatarUrl: googleUser.picture
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}
