import { InferSchemaType, Schema, model } from "mongoose";

// Address Schema - structured address for collection location
const AddressSchema = new Schema(
  {
    street: { type: String, required: true, maxlength: 300, trim: true },
    number: { type: String, required: true, maxlength: 20, trim: true },
    complement: { type: String, required: false, maxlength: 200, trim: true },
    neighborhood: { type: String, required: true, maxlength: 200, trim: true },
    city: { type: String, required: true, maxlength: 200, trim: true },
    state: { type: String, required: true, maxlength: 2, trim: true, uppercase: true },
    zipCode: { type: String, required: true, maxlength: 10, trim: true },
  },
  { _id: false }
);

// Host Schema - contact person at the institution for this collection
const HostSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      maxlength: 200,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    phone: {
      type: String,
      required: true,
      maxlength: 20,
      trim: true,
    },
  },
  { _id: false }
);

// Requested Date Schema - only references, no data duplication. Each requested date can have multiple slots or not. if not, it means any slot in that date is fine for this request.
const RequestedDateSchema = new Schema(
  {
    availableDateId: {
      type: Schema.Types.ObjectId,
      required: true,
    },
    slotIds: {
      type: [Schema.Types.ObjectId],
      required: false,
    },
  },
  { _id: false }
);

// Status History Schema for audit trail
const StatusHistorySchema = new Schema(
  {
    status: {
      type: String,
      required: true,
      enum: ["pending", "accepted", "rejected", "cancelled"],
    },
    changedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
    changedBy: {
      type: Schema.Types.UUID,
      required: false,
    },
    reason: {
      type: String,
      required: false,
    },
  },
  { _id: false }
);

export const CollectionRequestSchema = new Schema(
  {
    _id: { type: Schema.Types.ObjectId, auto: true },
    institutionId: {
      type: Schema.Types.UUID,
      required: true,
    },
    requestedByUserId: {
      type: Schema.Types.UUID,
      required: true,
    },
    bloodBanksLocationId: {
      type: Schema.Types.UUID,
      required: true,
    },
    requestedDates: {
      type: [RequestedDateSchema],
      required: true,
      validate: {
        validator: function (dates: any[]) {
          return dates.length >= 1 && dates.length <= 3;
        },
        message: "Must have between 1 and 3 requested dates",
      },
    },
    selectedAvailableDateId: {
      type: Schema.Types.ObjectId,
      required: false,
    },
    selectedSlotId: {
      type: Schema.Types.ObjectId,
      required: false,
    },
    status: {
      type: String,
      required: true,
      enum: ["pending", "accepted", "rejected", "cancelled"],
      default: "pending",
    },
    rejectionReason: {
      type: String,
      required: false,
      maxlength: 1000,
      trim: true,
    },
    host: {
      type: HostSchema,
      required: true,
    },
    address: {
      type: AddressSchema,
      required: false,
    },
    statusHistory: {
      type: [StatusHistorySchema],
      default: [],
    },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// Validation: when status is "accepted", selected fields are required
CollectionRequestSchema.pre("validate", function (next) {
  if (this.status === "accepted") {
    if (!this.selectedAvailableDateId || !this.selectedSlotId) {
      const error = new Error(
        "selectedAvailableDateId and selectedSlotId are required when status is 'accepted'"
      );
      return next(error);
    }
  }
  next();
});

// Indexes for performance
CollectionRequestSchema.index(
  { bloodBanksLocationId: 1, status: 1, deletedAt: 1 },
  { partialFilterExpression: { deletedAt: null } }
);

CollectionRequestSchema.index(
  { institutionId: 1, deletedAt: 1 },
  { partialFilterExpression: { deletedAt: null } }
);

CollectionRequestSchema.index(
  { requestedByUserId: 1 },
  { partialFilterExpression: { deletedAt: null } }
);

export type CollectionRequestSchema = InferSchemaType<
  typeof CollectionRequestSchema
>;
export type RequestedDateSchema = InferSchemaType<typeof RequestedDateSchema>;
export type StatusHistorySchema = InferSchemaType<typeof StatusHistorySchema>;
export type HostSchema = InferSchemaType<typeof HostSchema>;
export type AddressSchema = InferSchemaType<typeof AddressSchema>;

export const CollectionRequest = model<CollectionRequestSchema>(
  "CollectionRequest",
  CollectionRequestSchema
);
