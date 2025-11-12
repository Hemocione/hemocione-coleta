// Technical Visit Schema

import { InferSchemaType, Schema, model } from "mongoose";

export const TechnicalVisitSchema = new Schema(
  {
    _id: { type: Schema.Types.ObjectId, auto: true },
    bloodBankId: { type: Schema.Types.ObjectId, required: true },
    institutionId: {
      type: Schema.Types.UUID,
      required: true,
    },
    date: {
      type: Date,
      required: true,
    },
    status: {
      type: String,
      required: true,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
    createdAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
    updatedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
  },
  { timestamps: true }
);

TechnicalVisitSchema.pre("save", function (next) {
  this.updatedAt = new Date();
  if (!this.createdAt) {
    this.createdAt = this.updatedAt;
  }
  next();
});

TechnicalVisitSchema.index({ bloodBankId: 1, date: 1 });
TechnicalVisitSchema.index({ institutionId: 1 });

export type TechnicalVisitSchema = InferSchemaType<typeof TechnicalVisitSchema>;

export const TechnicalVisit = model<TechnicalVisitSchema>(
  "TechnicalVisit",
  TechnicalVisitSchema
);