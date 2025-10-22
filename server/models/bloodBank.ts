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

// Restriction Checklist Item
const RestrictionItemSchema = new Schema(
  {
    slug: {
      type: String,
      required: true,
      validate: {
        validator: function (v: string) {
          return /^[a-z0-9-]+$/.test(v);
        },
        message:
          "Slug must contain only lowercase letters, numbers, and hyphens",
      },
    },
    title: {
      type: String,
      required: true,
      maxlength: 100,
      validate: {
        validator: function (v: string) {
          return v.trim().length > 0;
        },
        message: "Title cannot be empty",
      },
    },
    description: {
      type: String,
      required: true,
      maxlength: 1000,
      validate: {
        validator: function (v: string) {
          return v.trim().length > 0;
        },
        message: "Description cannot be empty",
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
    restrictionChecklist: {
      type: [RestrictionItemSchema],
      default: [],
      validate: {
        validator: function (items: any[]) {
          if (!Array.isArray(items)) return false;

          // Check for duplicate slugs within the array
          const slugs = items.map((item) => item.slug);
          const uniqueSlugs = new Set(slugs);
          return slugs.length === uniqueSlugs.size;
        },
        message: "All restriction items must have unique slugs",
      },
    },
    timezone: {
      type: String,
      default: "America/Sao_Paulo",
      required: true,
    },
  },
  { timestamps: true }
);

// GeoIndexes for Mongoose - used for location-based queries
BloodBankSchema.index({ location: "2dsphere" });
BloodBankSchema.index({ coverageArea: "2dsphere" });

export type BloodBankSchema = InferSchemaType<typeof BloodBankSchema>;
export const BloodBank = model<BloodBankSchema>("BloodBank", BloodBankSchema);
