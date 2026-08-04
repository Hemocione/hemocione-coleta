import { useHemocioneUserAuth, assertSecretAuth } from "~/server/services/auth";

export default defineEventHandler((event) => {
  // Backoffice ANTES do filtro de /api/v1.
  //
  // As rotas de backoffice vivem em /api/backoffice/v1, que nao casa
  // /api/v1 - entao o guard abaixo retornava primeiro e a checagem de
  // secret ficava inalcancavel. Resultado: POST /api/backoffice/v1/bloodbanks
  // cadastrava hemocentro sem credencial nenhuma.
  if (event.path.startsWith("/api/backoffice")) {
    return assertSecretAuth(event);
  }

  // only run this for API routes
  if (!event.path.startsWith("/api/v1")) {
    return;
  }

  // Allow public endpoints without authentication
  if (event.path.startsWith("/api/v1/public")) {
    return;
  }

  const token = event.headers
    .get("Authorization")
    ?.replace("Bearer", "")
    .trim();
  if (!token) {
    throw createError({
      statusCode: 401,
      statusMessage: "Unauthorized - Missing Token",
    });
  }

  const user = useHemocioneUserAuth(event);

  event.context.auth = {
    token,
    user,
  };
});
