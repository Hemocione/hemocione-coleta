import { InferSchemaType, Schema, model } from "mongoose";

export const BloodBankSchema = new Schema(
  {
    _id: { type: String, required: true },
    name: { type: String, required: true },
    slug: { type: String, required: true, unique: true },
    bloodBanksLocationId: { type: String, required: true, unique: true },
    active: { type: Boolean, default: false, required: true },
    logo: { type: String, default: null, required: false },
    activatedAt: { type: Date, default: null },
    deactivatedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

export type BloodBankSchema = InferSchemaType<typeof BloodBankSchema>;

export const BloodBank = model<BloodBankSchema>("BloodBank", BloodBankSchema);
