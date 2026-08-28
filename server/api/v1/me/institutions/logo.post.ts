import {
  isHemocioneCdnUrl,
  MAX_INSTITUTION_LOGO_BYTES,
  validateInstitutionLogoData,
} from "~/utils/institutionLogo";

const MULTIPART_OVERHEAD_BYTES = 64 * 1024;
const MAX_MULTIPART_REQUEST_BYTES =
  MAX_INSTITUTION_LOGO_BYTES + MULTIPART_OVERHEAD_BYTES;

type RequestWithRawBody = {
  rawBody?: unknown;
  on: (event: string, listener: (...args: any[]) => void) => void;
  off: (event: string, listener: (...args: any[]) => void) => void;
  resume: () => void;
};

function readRequestBodyWithinLimit(
  request: RequestWithRawBody,
  limit: number
): Promise<Buffer | null> {
  if (request.rawBody !== undefined) {
    const body = Buffer.from(request.rawBody as Buffer);
    return Promise.resolve(body.byteLength <= limit ? body : null);
  }

  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let totalBytes = 0;
    let settled = false;

    const cleanup = () => {
      request.off("data", onData);
      request.off("end", onEnd);
      request.off("error", onError);
    };
    const onData = (chunk: Buffer | Uint8Array | string) => {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      totalBytes += buffer.byteLength;
      if (totalBytes > limit) {
        settled = true;
        cleanup();
        request.resume();
        resolve(null);
        return;
      }
      chunks.push(buffer);
    };
    const onEnd = () => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(Buffer.concat(chunks));
    };
    const onError = (error: unknown) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(error);
    };

    request.on("data", onData);
    request.on("end", onEnd);
    request.on("error", onError);
  });
}

export default defineEventHandler(async (event) => {
  const token = event.context.auth?.token;
  if (!token) {
    throw createError({ statusCode: 401, statusMessage: "Unauthorized" });
  }

  const contentType = getRequestHeader(event, "content-type") || "";
  if (!contentType.toLowerCase().startsWith("multipart/form-data")) {
    throw createError({
      statusCode: 422,
      statusMessage: "A logo deve ser enviada como multipart/form-data",
    });
  }

  const contentLength = Number(getRequestHeader(event, "content-length"));
  if (
    Number.isFinite(contentLength) &&
    contentLength > MAX_MULTIPART_REQUEST_BYTES
  ) {
    throw createError({
      statusCode: 413,
      statusMessage: "A logo deve ter no máximo 2 MB",
    });
  }

  const request = (event as any).node?.req as
    | RequestWithRawBody
    | undefined;
  if (request) {
    const rawBody = await readRequestBodyWithinLimit(
      request,
      MAX_MULTIPART_REQUEST_BYTES
    );
    if (rawBody === null) {
      throw createError({
        statusCode: 413,
        statusMessage: "A logo deve ter no máximo 2 MB",
      });
    }
    request.rawBody = rawBody;
  }

  const parts = await readMultipartFormData(event);
  const imagePart = parts?.find(
    (part) => part.name === "image" && part.filename && part.data
  );
  if (!imagePart?.data || !imagePart.filename) {
    throw createError({
      statusCode: 422,
      statusMessage: "Selecione um arquivo de logo",
    });
  }

  let validation;
  try {
    validation = validateInstitutionLogoData(
      imagePart.data,
      imagePart.type || ""
    );
  } catch (error: any) {
    throw createError({
      statusCode: error.message.includes("2 MB") ? 413 : 422,
      statusMessage: error.message,
    });
  }

  const config = useRuntimeConfig();
  const eventUrl = String(config.public.eventosHemocione).replace(/\/$/, "");
  const formData = new FormData();
  formData.append(
    "image",
    new Blob([Buffer.from(imagePart.data)], { type: validation.mimeType }),
    imagePart.filename
  );

  let response: Response;
  try {
    response = await fetch(`${eventUrl}/api/v1/image/upload`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });
  } catch {
    throw createError({
      statusCode: 502,
      statusMessage: "O serviço de upload está indisponível",
    });
  }

  const responseBody = await response.json().catch(() => null);
  if (!response.ok) {
    throw createError({
      statusCode: response.status || 502,
      statusMessage:
        responseBody?.statusMessage ||
        responseBody?.message ||
        "Não foi possível enviar a logo",
    });
  }

  if (
    typeof responseBody?.url !== "string" ||
    !isHemocioneCdnUrl(responseBody.url)
  ) {
    throw createError({
      statusCode: 502,
      statusMessage: "O serviço de upload não retornou a URL da logo",
    });
  }

  return { url: responseBody.url };
});
