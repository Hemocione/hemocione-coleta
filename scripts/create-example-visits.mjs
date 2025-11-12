import mongoose from "mongoose";
import { config } from "dotenv";

// Load environment variables
config();

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017";
const DB_NAME = process.env.DB_NAME || "coleta";

// Connect to MongoDB
await mongoose.connect(MONGODB_URI, {
  dbName: DB_NAME,
  authSource: "admin",
});

console.log("Connected to MongoDB");

// Define schemas
const BloodBankSchema = new mongoose.Schema({}, { strict: false });
const TechnicalVisitSchema = new mongoose.Schema(
  {
    bloodBankId: { type: mongoose.Schema.Types.ObjectId, required: true },
    institutionId: { type: String, required: true },
    date: { type: Date, required: true },
    status: {
      type: String,
      required: true,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
    createdAt: { type: Date, required: true, default: Date.now },
    updatedAt: { type: Date, required: true, default: Date.now },
  },
  { timestamps: true }
);

const BloodBank = mongoose.model("BloodBank", BloodBankSchema);
const TechnicalVisit = mongoose.model("TechnicalVisit", TechnicalVisitSchema);

try {
  // Get all blood banks
  let bloodBanks = await BloodBank.find({}).lean();

  if (bloodBanks.length === 0) {
    console.log("No blood banks found. Creating an example blood bank...");
    
    // Create an example blood bank
    const exampleBloodBank = new BloodBank({
      name: "Banco de Sangue Exemplo",
      slug: "exemplo",
      bloodBanksLocationId: "550e8400-e29b-41d4-a716-446655440010",
      active: true,
      location: {
        type: "Point",
        coordinates: [-43.1729, -22.9068], // Rio de Janeiro coordinates
      },
      timezone: "America/Sao_Paulo",
    });

    const savedBloodBank = await exampleBloodBank.save();
    bloodBanks = [savedBloodBank];
    console.log(`✅ Created example blood bank: ${savedBloodBank.name}`);
  }

  console.log(`Found ${bloodBanks.length} blood bank(s)`);
  
  // Show all blood banks
  bloodBanks.forEach((bb, i) => {
    console.log(`  ${i + 1}. ${bb.name} (${bb.bloodBanksLocationId})`);
  });

  // Get real institution IDs from collection requests
  const CollectionRequestSchema = new mongoose.Schema({}, { strict: false });
  const CollectionRequest = mongoose.model("CollectionRequest", CollectionRequestSchema);
  
  const collectionRequests = await CollectionRequest.find({}).limit(50).lean();
  const realInstitutionIds = [
    ...new Set(
      collectionRequests
        .map((cr) => cr.institutionId?.toString())
        .filter(Boolean)
    ),
  ];

  // Use real institution IDs if available, otherwise use example ones
  const exampleInstitutionIds =
    realInstitutionIds.length > 0
      ? realInstitutionIds
      : [
          "550e8400-e29b-41d4-a716-446655440000",
          "550e8400-e29b-41d4-a716-446655440001",
          "550e8400-e29b-41d4-a716-446655440002",
          "550e8400-e29b-41d4-a716-446655440003",
          "550e8400-e29b-41d4-a716-446655440004",
        ];

  if (realInstitutionIds.length > 0) {
    console.log(`\n✅ Using ${realInstitutionIds.length} real institution IDs from collection requests`);
  } else {
    console.log("\n⚠️  No real institution IDs found, using example UUIDs");
  }

  const statuses = ["pending", "approved", "rejected"];

  // Create example visits - create visits for ALL blood banks
  const visits = [];
  const now = new Date();

  // Create 10 visits per blood bank
  for (const bloodBank of bloodBanks) {
    for (let i = 0; i < 10; i++) {
      const institutionId = exampleInstitutionIds[i % exampleInstitutionIds.length];
      const status = statuses[i % statuses.length];

      // Create dates: some in the past, some in the future
      const daysAgo = Math.floor(Math.random() * 60) - 30; // -30 to 30 days
      const visitDate = new Date(now);
      visitDate.setDate(visitDate.getDate() + daysAgo);

      const visit = {
        bloodBankId: bloodBank._id,
        institutionId,
        date: visitDate,
        status,
        createdAt: new Date(
          now.getTime() - Math.random() * 30 * 24 * 60 * 60 * 1000
        ),
        updatedAt: new Date(),
      };

      visits.push(visit);
    }
  }

  // Check if visits already exist for these blood banks
  const existingVisits = await TechnicalVisit.find({
    bloodBankId: { $in: bloodBanks.map((bb) => bb._id) },
  }).lean();

  if (existingVisits.length > 0) {
    console.log(`\n⚠️  Found ${existingVisits.length} existing visits. Adding more...`);
  }

  // Save all visits
  const savedVisits = await TechnicalVisit.insertMany(visits);

  console.log(`\n✅ Created ${savedVisits.length} example technical visits`);
  
  // Show summary per blood bank
  console.log("\nSummary by blood bank:");
  for (const bloodBank of bloodBanks) {
    const count = await TechnicalVisit.countDocuments({
      bloodBankId: bloodBank._id,
    });
    console.log(`  - ${bloodBank.name}: ${count} visits`);
  }
  
  console.log("\nSample visits created:");
  savedVisits.slice(0, 5).forEach((v, i) => {
    const bb = bloodBanks.find((b) => b._id.toString() === v.bloodBankId.toString());
    console.log(
      `${i + 1}. [${bb?.name || "Unknown"}] Institution: ${v.institutionId}, Date: ${v.date.toLocaleDateString("pt-BR")}, Status: ${v.status}`
    );
  });
  
  if (savedVisits.length > 5) {
    console.log(`  ... and ${savedVisits.length - 5} more`);
  }

  await mongoose.disconnect();
  console.log("\n✅ Disconnected from MongoDB");
  process.exit(0);
} catch (error) {
  console.error("Error creating example technical visits:", error);
  await mongoose.disconnect();
  process.exit(1);
}

