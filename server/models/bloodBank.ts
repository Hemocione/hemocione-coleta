import { Schema, model, InferSchemaType } from "mongoose";

// Point: [longitude, latitude]
const PointSchema = new Schema({
  type: {
    type: String,
    enum: ["Point"],
    required: true,
    default: "Point",
  },
  coordinates: {
    type: [Number], // [longitude, latitude]
    required: true,
    validate: {
      validator: function (arr: number[]) {
        return arr.length === 2 && arr.every(Number.isFinite);
      },
      message: "Location coordinates must be [longitude, latitude]",
    },
  },
});

// Coverage Area: Polygon
const AreaSchema = new Schema(
  {
    type: {
      type: String,
      enum: ["Polygon"],
      required: true,
      default: "Polygon",
    },
    coordinates: {
      type: [[[Number]]], // [[[lng, lat], ...]]
      required: true,
      validate: {
        validator: function (arr: number[][][]) {
          return (
            Array.isArray(arr) &&
            arr.length > 0 &&
            arr.every(
              (ring) =>
                Array.isArray(ring) &&
                ring.length >= 4 &&
                ring.every(
                  (pos) =>
                    Array.isArray(pos) &&
                    pos.length === 2 &&
                    pos.every(Number.isFinite)
                )
            )
          );
        },
        message:
          "Coverage area coordinates must be a Polygon following GeoJSON spec",
      },
    },
  },
  { _id: false }
);

export const BloodBankSchema = new Schema(
  {
    _id: { type: String, required: true },
    name: { type: String, required: true },
    slug: { type: String, required: true, unique: true },
    bloodBanksLocationId: {
      type: Schema.Types.UUID,
      required: true,
      unique: true,
    },
    active: { type: Boolean, default: false, required: true },
    logo: { type: String, default: null, required: false },
    activatedAt: { type: Date, default: null },
    deactivatedAt: { type: Date, default: null },
    location: {
      type: PointSchema,
      required: true,
    },
    coverageArea: {
      type: AreaSchema,
      required: false,
    },
  },
  { timestamps: true }
);

// GeoIndexes for Mongoose - used for location-based queries
BloodBankSchema.index({ location: "2dsphere" });
BloodBankSchema.index({ coverageArea: "2dsphere" });

export type BloodBankSchema = InferSchemaType<typeof BloodBankSchema>;
export const BloodBank = model<BloodBankSchema>("BloodBank", BloodBankSchema);
