import { technicalVisit, bloodBank } from "~/server/models";
const { TechnicalVisit } = technicalVisit;
const { BloodBank } = bloodBank;

export default defineEventHandler(async (event) => {
  try {
    // Only allow in development
    if (process.env.NODE_ENV === "production") {
      throw createError({
        statusCode: 403,
        statusMessage: "This endpoint is only available in development",
      });
    }

    // Get all blood banks
    const bloodBanks = await BloodBank.find({}).limit(5).lean();

    if (bloodBanks.length === 0) {
      throw createError({
        statusCode: 404,
        statusMessage: "No blood banks found. Please create a blood bank first.",
      });
    }

    // Generate example institution IDs (UUIDs)
    const exampleInstitutionIds = [
      "550e8400-e29b-41d4-a716-446655440000",
      "550e8400-e29b-41d4-a716-446655440001",
      "550e8400-e29b-41d4-a716-446655440002",
      "550e8400-e29b-41d4-a716-446655440003",
      "550e8400-e29b-41d4-a716-446655440004",
    ];

    const statuses: Array<"pending" | "approved" | "rejected"> = [
      "pending",
      "approved",
      "rejected",
    ];

    // Create example visits
    const visits = [];
    const now = new Date();

    for (let i = 0; i < 10; i++) {
      const bloodBank = bloodBanks[i % bloodBanks.length];
      const institutionId =
        exampleInstitutionIds[i % exampleInstitutionIds.length];
      const status = statuses[i % statuses.length];

      // Create dates: some in the past, some in the future
      const daysAgo = Math.floor(Math.random() * 60) - 30; // -30 to 30 days
      const visitDate = new Date(now);
      visitDate.setDate(visitDate.getDate() + daysAgo);

      const visit = new TechnicalVisit({
        bloodBankId: bloodBank._id,
        institutionId,
        date: visitDate,
        status,
        createdAt: new Date(now.getTime() - Math.random() * 30 * 24 * 60 * 60 * 1000), // Random date in last 30 days
        updatedAt: new Date(),
      });

      visits.push(visit);
    }

    // Save all visits
    const savedVisits = await TechnicalVisit.insertMany(visits);

    return {
      success: true,
      message: `Created ${savedVisits.length} example technical visits`,
      data: savedVisits.map((v) => ({
        _id: v._id.toString(),
        bloodBankId: v.bloodBankId.toString(),
        institutionId: v.institutionId,
        date: v.date,
        status: v.status,
      })),
    };
  } catch (error: any) {
    console.error("Error creating example technical visits:", error);

    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.message || "Internal server error",
    });
  }
});

