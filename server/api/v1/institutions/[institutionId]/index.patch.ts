import { updateInstitutionProfile } from "~/server/services/hemocioneId";
import { z } from "zod";
import { isHemocioneCdnUrl } from "~/utils/institutionLogo";

const bodySchema = z
  .object({
    name: z.string().trim().min(1).max(255).optional(),
    legalName: z.string().trim().max(255).nullable().optional(),
    address: z.string().trim().max(500).nullable().optional(),
    phone: z.string().trim().max(50).nullable().optional(),
    city: z.string().trim().min(1).max(255).optional(),
    state: z.string().trim().length(2).optional(),
    latitude: z.number().finite().min(-90).max(90).nullable().optional(),
    longitude: z.number().finite().min(-180).max(180).nullable().optional(),
    logo: z
      .string()
      .url()
      .refine(isHemocioneCdnUrl, "A logo deve usar a CDN do Hemocione")
      .nullable()
      .optional(),
  })
  .strict()
  .refine((body) => Object.keys(body).length > 0, {
    message: "At least one field is required",
  });

export default defineEventHandler(async (event) => {
  const token = event.context.auth?.token;
  const institutionId = getRouterParam(event, "institutionId");
  if (!token || !institutionId) {
    throw createError({ statusCode: 401, statusMessage: "Unauthorized" });
  }

  if (!z.string().uuid().safeParse(institutionId).success) {
    throw createError({ statusCode: 400, statusMessage: "Invalid institution ID" });
  }

  const parsedBody = bodySchema.safeParse(await readBody(event));
  if (!parsedBody.success) {
    throw createError({
      statusCode: 400,
      statusMessage: parsedBody.error.issues.map((issue) => issue.message).join("; "),
    });
  }

  let institution;
  try {
    institution = await updateInstitutionProfile(token, institutionId, parsedBody.data);
  } catch (error: any) {
    const statusCode = error?.statusCode || error?.response?.status;
    if ([400, 401, 403, 404].includes(statusCode)) {
      throw createError({
        statusCode,
        statusMessage: error?.data?.statusMessage || error?.message,
      });
    }
    throw error;
  }
  return { institution };
});
