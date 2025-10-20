import { getMe } from "~/server/services/hemocioneId";

export default defineEventHandler(async (event) => {
  return getMe(event.context.auth.token);
});
