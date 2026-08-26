import { getCookie, sendRedirect } from "h3";
import { verifyAndReturnData } from "~/server/services/jwt";

export default defineEventHandler((event) => {
  const path = event.path.split("?")[0];
  if (path !== "/") return;

  const config = useRuntimeConfig();
  const token = getCookie(event, config.public.authCookieKey);
  if (!token) return;

  try {
    verifyAndReturnData(token);
  } catch {
    return;
  }

  return sendRedirect(event, "/agendar", 302);
});
