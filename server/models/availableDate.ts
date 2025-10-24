import { InferSchemaType, Schema, model } from "mongoose";

// Slot Schema - subdocumento para cada time
const SlotSchema = new Schema(
  {
    teamId: { type: Schema.Types.ObjectId, required: true },
    startTime: { type: Date, required: true },
    endTime: { type: Date, required: true },
    locked: { type: Boolean, default: false },
    lockedBy: {
      type: Schema.Types.ObjectId,
      required: false,
    },
  },
  { _id: true }
);

// Validação customizada para startTime < endTime
SlotSchema.pre("validate", function (next) {
  if (this.startTime >= this.endTime) {
    const error = new Error("startTime deve ser anterior a endTime");
    return next(error);
  }
  next();
});

export const AvailableDateSchema = new Schema(
  {
    bloodBanksLocationId: { type: Schema.Types.UUID, required: true },
    date: {
      type: String,
      required: true,
      match: /^\d{4}-\d{2}-\d{2}$/,
      validate: {
        validator: function (v: string) {
          // Validate YYYY-MM-DD format and that it's a valid date
          const date = new Date(v);
          return (
            date instanceof Date &&
            !isNaN(date.getTime()) &&
            v === date.toISOString().split("T")[0]
          );
        },
        message: "Date must be in YYYY-MM-DD format",
      },
    },
    year: { type: Number, required: true },
    isAllTeams: { type: Boolean, required: true },
    slots: [SlotSchema],
    deletedAt: { type: Date, default: null },
  },
  { _id: true, timestamps: true }
);

// Virtual field para verificar se todos os slots estão locked
AvailableDateSchema.virtual("allSlotsLocked").get(function () {
  return (
    this.slots.length > 0 &&
    this.slots.every((slot) => slot.locked || slot.lockedBy)
  );
});

// Índice composto único parcial para evitar duplicatas por data
AvailableDateSchema.index(
  { bloodBanksLocationId: 1, date: 1 },
  {
    unique: true,
    partialFilterExpression: { deletedAt: null },
  }
);

// Índice para queries por ano
AvailableDateSchema.index(
  { bloodBanksLocationId: 1, year: 1 },
  { partialFilterExpression: { deletedAt: null } }
);

// Índice para queries de disponibilidade
AvailableDateSchema.index(
  { bloodBanksLocationId: 1, date: 1, "slots.locked": 1 },
  { partialFilterExpression: { deletedAt: null } }
);

export type AvailableDateSchema = InferSchemaType<typeof AvailableDateSchema>;
export type SlotSchema = InferSchemaType<typeof SlotSchema>;

export const AvailableDate = model<AvailableDateSchema>(
  "AvailableDate",
  AvailableDateSchema
);
