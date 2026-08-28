import { z } from "zod";
import { useHemocioneUserAuth } from "~/server/services/auth";
import { getBloodBankByBloodBanksLocationId } from "~/server/services/bloodBank";
import { createBloodBankInterest } from "~/server/services/bloodBankInterest";
import { getOndeDoarBloodBankByLocationId } from "~/server/services/ondeDoar";

const phoneSchema = z
  .string()
  .trim()
  .min(1)
  .max(30)
  .regex(/^[+\d()\s-]+$/);
const nameSchema = z.string().trim().min(1).max(200);

const bodySchema = z.object({
  bloodBanksLocationId: z.string().uuid(),
  bankName: z.string().trim().max(200).optional(),
  name: nameSchema.optional(),
  phone: phoneSchema.optional(),
  origin: z.literal("ondedoar"),
});

function invalidRequest(statusMessage: string) {
  throw createError({ statusCode: 400, statusMessage });
}

function normalizePhone(phone: string) {
  const normalized = phone.replace(/\D/g, "");
  if (normalized.length < 10 || normalized.length > 13) {
    invalidRequest("Invalid phone number");
  }
  return normalized;
}

export default defineEventHandler(async (event) => {
  const parsedBody = bodySchema.safeParse(await readBody(event));
  if (!parsedBody.success) invalidRequest("Invalid interest data");

  const body = parsedBody.data;
  const authorization = event.headers.get("authorization");
  const user = authorization ? useHemocioneUserAuth(event) : undefined;
  const ondeDoarBloodBank = await getOndeDoarBloodBankByLocationId(
    body.bloodBanksLocationId,
  );
  if (!ondeDoarBloodBank) {
    throw createError({
      statusCode: 404,
      statusMessage: "Blood bank is not available in OndeDoar",
    });
  }

  const localBloodBank = await getBloodBankByBloodBanksLocationId(
    body.bloodBanksLocationId,
  );
  if (localBloodBank?.hidden) {
    throw createError({
      statusCode: 404,
      statusMessage: "Blood bank is not available",
    });
  }
  if (localBloodBank?.active) {
    throw createError({
      statusCode: 409,
      statusMessage: "Active blood banks use the scheduling flow",
    });
  }

  const name = user
    ? [user.givenName, user.surName].filter(Boolean).join(" ").trim()
    : body.name;
  const phone = user ? user.phone : body.phone;
  if (!name || !phone) invalidRequest("Name and phone are required");

  const parsedName = nameSchema.safeParse(name);
  if (!parsedName.success) invalidRequest("Invalid name");

  const parsedPhone = phoneSchema.safeParse(phone);
  if (!parsedPhone.success) invalidRequest("Invalid phone number");

  const phoneNormalized = normalizePhone(parsedPhone.data);
  const result = await createBloodBankInterest({
    bloodBanksLocationId: body.bloodBanksLocationId,
    bankName: ondeDoarBloodBank.name,
    name: parsedName.data,
    phone: parsedPhone.data,
    phoneNormalized,
    userId: user?.id,
    origin: body.origin,
    dedupeKey: `${body.bloodBanksLocationId}:${phoneNormalized}`,
  });

  return { success: true, data: result };
});
