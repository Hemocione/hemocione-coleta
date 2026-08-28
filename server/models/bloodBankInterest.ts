import { InferSchemaType, Schema, model } from "mongoose";

export const BloodBankInterestSchema = new Schema(
  {
    bloodBanksLocationId: {
      type: Schema.Types.UUID,
      required: true,
      index: true,
    },
    bankName: { type: String, required: true, maxlength: 200 },
    name: { type: String, required: true, maxlength: 200 },
    phone: { type: String, required: true, maxlength: 30 },
    phoneNormalized: { type: String, required: true, maxlength: 20 },
    institutionId: {
      type: Schema.Types.UUID,
      default: null,
      index: true,
    },
    institutionName: {
      type: String,
      required: true,
      maxlength: 200,
      trim: true,
    },
    institutionDocument: {
      type: String,
      default: null,
      maxlength: 14,
      trim: true,
    },
    userId: { type: String, default: null, maxlength: 200 },
    origin: { type: String, enum: ["ondedoar"], required: true },
    dedupeKey: { type: String, required: true, unique: true, index: true },
    discordStatus: {
      type: String,
      enum: ["pending", "delivering", "sent", "failed", "disabled"],
      required: true,
      default: "pending",
    },
    discordAttempts: { type: Number, required: true, default: 0 },
    discordLastError: { type: String, default: null, maxlength: 200 },
    discordLastAttemptAt: { type: Date, default: null },
    discordSentAt: { type: Date, default: null },
  },
  { timestamps: true },
);

BloodBankInterestSchema.index({ bloodBanksLocationId: 1, phoneNormalized: 1 });

export type BloodBankInterestSchema = InferSchemaType<
  typeof BloodBankInterestSchema
>;
export const BloodBankInterest = model<BloodBankInterestSchema>(
  "BloodBankInterest",
  BloodBankInterestSchema,
);
