import { z } from "zod";
import { collectionRequest } from "~/server/models";
import {
  assertUserAccessToInstitutionId,
  useHemocioneUserAuth,
} from "~/server/services/auth";

const { CollectionRequest } = collectionRequest;

const eventBrandingSchema = z
  .object({
    banner: z.string().url().optional(),
    logo: z.string().url().optional(),
    address: z.string().optional(),
  })
  .strict();

export default defineEventHandler(async (event) => {
  const institutionId = getRouterParam(event, "institutionId");
  const requestId = getRouterParam(event, "requestId");

  if (!institutionId || !requestId) {
    throw createError({
      statusCode: 400,
      statusMessage: "Institution ID and Request ID are required",
    });
  }

  const user = useHemocioneUserAuth(event);
  assertUserAccessToInstitutionId(user, institutionId);

  try {
    const body = await readBody(event);
    const branding = eventBrandingSchema.parse(body);

    const request = await CollectionRequest.findOne({
      _id: requestId,
      deletedAt: null,
    }).lean();

    if (
      !request ||
      request.institutionId.toString() !== institutionId
    ) {
      throw createError({
        statusCode: 404,
        statusMessage: "Collection request not found for this institution",
      });
    }

    if (request.status !== "scheduled" || !request.eventSlug) {
      throw createError({
        statusCode: 400,
        statusMessage: "evento ainda não foi gerado",
      });
    }

    const config = useRuntimeConfig();
    const eventUrl = String(config.hemocioneDigitalEventUrl).replace(/\/$/, "");
    const upstreamBody = {
      ...(branding.banner !== undefined && { banner: branding.banner }),
      ...(branding.logo !== undefined && { logo: branding.logo }),
      ...(branding.address !== undefined && {
        location: { address: branding.address },
      }),
    };

    const upstreamResponse = await fetch(
      `${eventUrl}/api/v1/event/${request.eventSlug}`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "x-coleta-integration-secret": config.coletaIntegrationSecret,
        },
        body: JSON.stringify(upstreamBody),
      }
    );

    if (!upstreamResponse.ok) {
      let statusMessage =
        upstreamResponse.statusText || "Failed to update event branding";

      if (typeof upstreamResponse.json === "function") {
        const upstreamError = await upstreamResponse.json().catch(() => null);
        statusMessage =
          upstreamError?.statusMessage ||
          upstreamError?.message ||
          statusMessage;
      }

      throw createError({
        statusCode: upstreamResponse.status || 502,
        statusMessage,
      });
    }

    const data =
      typeof upstreamResponse.json === "function"
        ? await upstreamResponse.json().catch(() => undefined)
        : undefined;

    return {
      success: true,
      data,
    };
  } catch (error: any) {
    if (error.statusCode) {
      throw error;
    }

    if (error.name === "ZodError") {
      throw createError({
        statusCode: 400,
        statusMessage: "Dados inválidos ou campos não permitidos",
      });
    }

    throw createError({
      statusCode: 502,
      statusMessage: error.message || "Failed to update event branding",
    });
  }
});
