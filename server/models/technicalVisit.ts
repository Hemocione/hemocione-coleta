import { type InferSchemaType, Schema, model } from "mongoose";

export const TechnicalVisitSchema = new Schema(
  {
    _id: { type: Schema.Types.ObjectId, auto: true },
    bloodBanksLocationId: { type: Schema.Types.UUID, required: true },
    institutionId: { type: Schema.Types.UUID, required: false },
    address: { type: String, required: true, maxlength: 500, trim: true },
    location: {
      type: {
        type: String,
        enum: ["Point"],
        required: false,
      },
      coordinates: {
        type: [Number],
        required: false,
      },
    },
    visitDate: { type: Date, required: true },
    outcome: {
      type: String,
      required: true,
      enum: ["approved", "rejected", "pending"],
    },
    notes: { type: String, required: false, maxlength: 2000, trim: true },
    visitedBy: { type: Schema.Types.UUID, required: true },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// Index for fast lookup by bloodBanksLocationId + institutionId
TechnicalVisitSchema.index(
  { bloodBanksLocationId: 1, institutionId: 1 },
  { partialFilterExpression: { deletedAt: null } }
);

// Index for fast lookup by bloodBanksLocationId + address
TechnicalVisitSchema.index(
  { bloodBanksLocationId: 1, address: 1 },
  { partialFilterExpression: { deletedAt: null } }
);

export type TechnicalVisitSchema = InferSchemaType<
  typeof TechnicalVisitSchema
>;

export const TechnicalVisit = model<TechnicalVisitSchema>(
  "TechnicalVisit",
  TechnicalVisitSchema
);
