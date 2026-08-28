import { z } from "zod";
import { createInstitution } from "~/server/services/hemocioneId";
import { isHemocioneCdnUrl } from "~/utils/institutionLogo";

const bodySchema = z.object({
  name: z.string().min(2),
  legalName: z.string().min(2),
  document: z.string().min(8),
  kind: z.string().default("company"),
  address: z.string().min(3),
  phone: z.string().min(8),
  city: z.string().min(2),
  state: z.string().min(2),
  logo: z
    .string()
    .url()
    .refine(isHemocioneCdnUrl, "A logo deve usar a CDN do Hemocione")
    .nullable()
    .optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
});

export default defineEventHandler(async (event) => {
  const token = event.context.auth?.token;
  if (!token) {
    throw createError({ statusCode: 401, statusMessage: "Unauthorized" });
  }
  const body = await readBody(event);
  const payload = bodySchema.parse(body);
  const inst = await createInstitution(token, payload);
  return inst;
});
