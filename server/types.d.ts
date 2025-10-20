import type { HemocioneUserAuthTokenData } from "~/server/services/auth";

declare module "h3" {
  interface H3EventContext {
    auth: {
      token: string;
      user: HemocioneUserAuthTokenData;
    };
  }
}
