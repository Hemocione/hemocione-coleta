import { InferSchemaType, Schema, model } from "mongoose";

export const TeamSchema = new Schema(
  {
    _id: { type: String, required: true },
    bloodBanksLocationId: { type: Schema.Types.UUID, required: true },
    name: { type: String, required: true },
    color: {
      type: String,
      required: true,
      validate: {
        validator: function (v: string) {
          return /^#[0-9A-Fa-f]{6}$/.test(v);
        },
        message: "Color must be a valid hex color code (e.g., #RRGGBB)",
      },
    },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// Index on bloodBanksLocationId for fast queries
TeamSchema.index(
  { bloodBanksLocationId: 1 },
  { partialFilterExpression: { deletedAt: null } }
);

// Partial unique compound index on (bloodBanksLocationId, name) for non-deleted teams only
TeamSchema.index(
  { bloodBanksLocationId: 1, name: 1 },
  {
    unique: true,
    partialFilterExpression: { deletedAt: null },
  }
);

export type TeamSchema = InferSchemaType<typeof TeamSchema>;

export const Team = model<TeamSchema>("Team", TeamSchema);
