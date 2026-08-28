import { z } from "zod";
import { useHemocioneUserAuth } from "~/server/services/auth";
import { getBloodBankByBloodBanksLocationId } from "~/server/services/bloodBank";
import { createBloodBankInterest } from "~/server/services/bloodBankInterest";
import { getUserInstitutions } from "~/server/services/hemocioneId";
import { getOndeDoarBloodBankByLocationId } from "~/server/services/ondeDoar";
import { isValidCnpj, onlyDigits } from "~/utils/cnpj";

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
  institutionId: z.string().uuid().optional(),
  institutionName: nameSchema.optional(),
  institutionCnpj: z.string().trim().max(30).optional(),
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

function normalizeCnpj(cnpj?: string) {
  if (!cnpj?.trim()) return undefined;
  const normalized = onlyDigits(cnpj);
  if (!isValidCnpj(normalized)) invalidRequest("Invalid institution CNPJ");
  return normalized;
}

export default defineEventHandler(async (event) => {
  const parsedBody = bodySchema.safeParse(await readBody(event));
  if (!parsedBody.success) invalidRequest("Invalid interest data");

  const body = parsedBody.data;
  const authorization = event.headers.get("authorization")?.trim();
  const token = authorization?.replace(/^Bearer\s+/i, "").trim();
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

  let institutionId: string | undefined;
  let institutionName: string;
  let institutionDocument: string | undefined;
  if (user) {
    if (!token || !body.institutionId) {
      invalidRequest("Institution is required");
    }
    const institutions = await getUserInstitutions(token);
    const institution = institutions.find(
      ({ id }) => id === body.institutionId,
    );
    if (!institution) {
      throw createError({
        statusCode: 403,
        statusMessage: "User does not have access to this institution",
      });
    }
    const canonicalName = institution.name?.trim();
    if (!canonicalName) invalidRequest("Institution name is required");
    institutionId = institution.id;
    institutionName = canonicalName;
    institutionDocument = institution.document
      ? onlyDigits(institution.document)
      : undefined;
  } else {
    const parsedInstitutionName = nameSchema.safeParse(body.institutionName);
    if (!parsedInstitutionName.success) {
      invalidRequest("Institution name is required");
    }
    institutionName = parsedInstitutionName.data;
    institutionDocument = normalizeCnpj(body.institutionCnpj);
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
    institutionId,
    institutionName,
    institutionDocument,
    userId: user?.id,
    origin: body.origin,
    dedupeKey: `${body.bloodBanksLocationId}:${phoneNormalized}`,
  });

  return { success: true, data: result };
});
