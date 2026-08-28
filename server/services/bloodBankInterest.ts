import { bloodBankInterest } from "~/server/models";
import { sendBloodBankInterestToDiscord } from "~/server/services/discord";

const { BloodBankInterest } = bloodBankInterest;

export interface CreateBloodBankInterestInput {
  bloodBanksLocationId: string;
  bankName: string;
  name: string;
  phone: string;
  phoneNormalized: string;
  institutionId?: string;
  institutionName: string;
  institutionDocument?: string;
  userId?: string;
  origin: "ondedoar";
  dedupeKey: string;
}

export interface CreateBloodBankInterestResult {
  id: string;
  created: boolean;
  deliveryStatus: "sent" | "disabled" | "pending";
}

export class BloodBankInterestDeliveryError extends Error {
  statusCode = 502;

  constructor() {
    super("Interest saved but Discord delivery failed");
    this.name = "BloodBankInterestDeliveryError";
  }
}

async function findByDedupeKey(dedupeKey: string) {
  return BloodBankInterest.findOne({ dedupeKey }).lean().exec();
}

function asId(value: unknown) {
  return value?.toString?.() || "";
}

const DELIVERY_CLAIM_TIMEOUT_MS = 5 * 60 * 1000;

async function deliverInterest(
  interest: any,
  input: CreateBloodBankInterestInput,
): Promise<"sent" | "disabled" | "pending"> {
  const now = new Date();
  const staleClaimAt = new Date(now.getTime() - DELIVERY_CLAIM_TIMEOUT_MS);
  const claimedInterest = await BloodBankInterest.findOneAndUpdate(
    {
      _id: interest._id,
      $or: [
        { discordStatus: { $in: ["pending", "failed"] } },
        {
          discordStatus: "delivering",
          discordLastAttemptAt: { $lt: staleClaimAt },
        },
      ],
    },
    {
      $set: {
        discordStatus: "delivering",
        discordLastAttemptAt: now,
        discordLastError: null,
      },
      $inc: { discordAttempts: 1 },
    },
    { new: true, lean: true },
  )
    .lean()
    .exec();

  if (!claimedInterest) return "pending";

  let delivery: Awaited<ReturnType<typeof sendBloodBankInterestToDiscord>>;
  try {
    delivery = await sendBloodBankInterestToDiscord({
      bloodBanksLocationId: input.bloodBanksLocationId,
      bankName: input.bankName,
      name: input.name,
      phone: input.phone,
      institutionId: input.institutionId,
      institutionName: input.institutionName,
      institutionDocument: input.institutionDocument,
      userId: input.userId,
      origin: input.origin,
    });
  } catch {
    try {
      await BloodBankInterest.updateOne(
        { _id: claimedInterest._id },
        {
          $set: {
            discordStatus: "failed",
            discordLastAttemptAt: new Date(),
            discordLastError: "Discord delivery failed",
          },
        },
      );
    } catch {
      // Preserve the delivery error. The request remains non-successful.
    }
    throw new BloodBankInterestDeliveryError();
  }

  try {
    const deliveredAt = new Date();
    if (delivery.status === "disabled") {
      await BloodBankInterest.updateOne(
        { _id: claimedInterest._id },
        {
          $set: {
            discordStatus: "disabled",
            discordLastAttemptAt: deliveredAt,
            discordLastError: null,
          },
        },
      );
      return "disabled";
    }

    await BloodBankInterest.updateOne(
      { _id: claimedInterest._id },
      {
        $set: {
          discordStatus: "sent",
          discordLastAttemptAt: deliveredAt,
          discordSentAt: deliveredAt,
          discordLastError: null,
        },
      },
    );
    return "sent";
  } catch {
    // Discord already accepted the message. Keep delivering for stale-claim retry.
    throw new Error("Interest delivery status could not be saved");
  }
}

export async function createBloodBankInterest(
  input: CreateBloodBankInterestInput,
): Promise<CreateBloodBankInterestResult> {
  const existing = await findByDedupeKey(input.dedupeKey);
  if (existing) {
    const id = asId(existing._id);
    if (existing.discordStatus === "sent") {
      return { id, created: false, deliveryStatus: "sent" };
    }
    if (existing.discordStatus === "disabled") {
      return { id, created: false, deliveryStatus: "disabled" };
    }

    const deliveryStatus = await deliverInterest(existing, input);
    return { id, created: false, deliveryStatus };
  }

  let interest: any;
  try {
    interest = await BloodBankInterest.create({
      ...input,
      discordStatus: "pending",
      discordAttempts: 0,
      discordLastError: null,
      discordLastAttemptAt: null,
      discordSentAt: null,
    });
  } catch (error: any) {
    if (error?.code !== 11000) throw error;
    const duplicate = await findByDedupeKey(input.dedupeKey);
    if (!duplicate) throw error;
    if (duplicate.discordStatus === "sent") {
      return {
        id: asId(duplicate._id),
        created: false,
        deliveryStatus: "sent",
      };
    }
    if (duplicate.discordStatus === "disabled") {
      return {
        id: asId(duplicate._id),
        created: false,
        deliveryStatus: "disabled",
      };
    }
    const deliveryStatus = await deliverInterest(duplicate, input);
    return { id: asId(duplicate._id), created: false, deliveryStatus };
  }

  const deliveryStatus = await deliverInterest(interest, input);
  return { id: asId(interest._id), created: true, deliveryStatus };
}
