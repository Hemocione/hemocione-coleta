import { type InferSchemaType, Schema, model } from "mongoose";

export const CommitmentTermSchema = new Schema(
  {
    _id: { type: Schema.Types.ObjectId, auto: true },
    bloodBanksLocationId: { type: Schema.Types.UUID, required: true },
    collectionRequestId: {
      type: Schema.Types.ObjectId,
      required: false,
      default: null,
    },
    technicalVisitId: {
      type: Schema.Types.ObjectId,
      required: false,
      default: null,
    },
    generatedContent: { type: String, required: true, maxlength: 20000 },
    sentTo: { type: String, required: true, maxlength: 200, trim: true },
    sentAt: { type: Date, required: false, default: null },
    status: {
      type: String,
      required: true,
      enum: ["draft", "sent", "acknowledged"],
      default: "draft",
    },
    acknowledgedAt: { type: Date, required: false, default: null },
  },
  { timestamps: true }
);

CommitmentTermSchema.index({ bloodBanksLocationId: 1, collectionRequestId: 1 });
CommitmentTermSchema.index({ bloodBanksLocationId: 1, technicalVisitId: 1 });

export type CommitmentTermSchema = InferSchemaType<typeof CommitmentTermSchema>;

export const CommitmentTerm = model<CommitmentTermSchema>(
  "CommitmentTerm",
  CommitmentTermSchema
);
