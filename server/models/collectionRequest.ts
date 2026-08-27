import { InferSchemaType, Schema, model } from "mongoose";
import { randomBytes } from "crypto";

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
    startTime: {
      type: String,
      required: false,
    },
    endTime: {
      type: String,
      required: false,
    },
    priority: {
      type: Number,
      required: true,
      min: 1,
      max: 3,
    },
  },
  { _id: false }
);

const CounterProposalDateSchema = new Schema(
  {
    date: { type: Date, required: true },
    startTime: { type: String, required: true },
    endTime: { type: String, required: false },
    durationMinutes: { type: Number, required: false },
    teamName: { type: String, required: false, maxlength: 100, trim: true },
    note: { type: String, required: true },
  },
  { _id: false }
);

const CounterProposalResponseSchema = new Schema(
  {
    decision: {
      type: String,
      required: true,
      enum: ["accepted", "declined"],
    },
    selectedDateId: { type: String, required: true },
    respondedAt: { type: Date, required: true },
    respondedBy: { type: String, required: true },
  },
  { _id: false }
);

const CounterProposalSchema = new Schema(
  {
    proposedDates: {
      type: [CounterProposalDateSchema],
      required: true,
    },
    needsTechnicalVisit: { type: Boolean, required: true },
    note: { type: String, required: true },
    proposedBy: { type: String, required: true },
    proposedAt: { type: Date, required: true },
    response: {
      type: CounterProposalResponseSchema,
      required: false,
    },
  },
  { _id: false }
);

// Reaproveita CounterProposalDateSchema/CounterProposalResponseSchema (mesma
// forma) para manter a proposta de data/hora da visita técnica num campo
// separado de counterProposal — evita colidir com confirmedSchedule, que já
// representa a data do EVENTO.
const VisitProposalSchema = new Schema(
  {
    proposedDates: {
      type: [CounterProposalDateSchema],
      required: true,
    },
    note: { type: String, required: true },
    proposedBy: { type: String, required: true },
    proposedAt: { type: Date, required: true },
    response: {
      type: CounterProposalResponseSchema,
      required: false,
    },
  },
  { _id: false }
);

const ConfirmedScheduleSchema = new Schema(
  {
    date: { type: Date, required: true },
    startTime: { type: String, required: true },
    // Optional for records created before confirmed counter-proposal schedules
    // stored the calculated end time.
    endTime: { type: String, required: false },
    durationMinutes: { type: Number, required: true },
    teamName: { type: String, required: false, maxlength: 100, trim: true },
  },
  { _id: false }
);

const COLLECTION_REQUEST_STATUSES = [
  "pending",
  "accepted",
  "rejected",
  "cancelled",
  "counter_proposed",
  "counter_proposal_declined",
  "awaiting_technical_visit",
  "technical_visit_confirmed",
  "scheduled",
] as const;

// Status History Schema for audit trail
const StatusHistorySchema = new Schema(
  {
    status: {
      type: String,
      required: true,
      enum: COLLECTION_REQUEST_STATUSES,
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
          if (dates.length < 1 || dates.length > 3) return false;
          const priorities = dates.map((d) => d.priority);
          const uniquePriorities = new Set(priorities);
          if (uniquePriorities.size !== dates.length) return false;
          return priorities.every((p) => p >= 1 && p <= dates.length);
        },
        message:
          "Must have between 1 and 3 requested dates with unique priorities from 1 to the number of dates",
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
    note: {
      type: String,
      required: false,
    },
    technicalVisitId: {
      type: Schema.Types.ObjectId,
      ref: "TechnicalVisit",
      required: false,
    },
    counterProposal: {
      type: CounterProposalSchema,
      required: false,
    },
    previousCounterProposals: {
      type: [CounterProposalSchema],
      required: false,
      default: [],
    },
    visitProposal: {
      type: VisitProposalSchema,
      required: false,
    },
    previousVisitProposals: {
      type: [VisitProposalSchema],
      required: false,
      default: [],
    },
    confirmedSchedule: {
      type: ConfirmedScheduleSchema,
      required: false,
    },
    eventSlug: {
      type: String,
      required: false,
    },
    status: {
      type: String,
      required: true,
      enum: COLLECTION_REQUEST_STATUSES,
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
    accessToken: {
      type: String,
      required: true,
      unique: true,
      default: () => randomBytes(32).toString("hex"),
    },
    statusHistory: {
      type: [StatusHistorySchema],
      default: [],
    },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// Validation: when status is "accepted", selected fields or a confirmed schedule are required
CollectionRequestSchema.pre("validate", function (next) {
  if (this.status === "accepted") {
    const hasSelectedSlot =
      this.selectedAvailableDateId && this.selectedSlotId;
    if (!hasSelectedSlot && !this.confirmedSchedule) {
      const error = new Error(
        "selectedAvailableDateId and selectedSlotId or confirmedSchedule are required when status is 'accepted'"
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
