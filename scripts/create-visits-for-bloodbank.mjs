import mongoose from "mongoose";
import { config } from "dotenv";

// Load environment variables
config();

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017";
const DB_NAME = process.env.DB_NAME || "hemocione-coleta";

// Get bloodBanksLocationId from command line argument
const bloodBanksLocationId = process.argv[2];

if (!bloodBanksLocationId) {
  console.error("Usage: node scripts/create-visits-for-bloodbank.mjs <bloodBanksLocationId>");
  console.error("\nExample:");
  console.error("  node scripts/create-visits-for-bloodbank.mjs 550e8400-e29b-41d4-a716-446655440010");
  process.exit(1);
}

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
  // Find the blood bank by bloodBanksLocationId
  const bloodBank = await BloodBank.findOne({
    bloodBanksLocationId,
  }).lean();

  if (!bloodBank) {
    console.error(`❌ Blood bank with bloodBanksLocationId "${bloodBanksLocationId}" not found.`);
    console.log("\nAvailable blood banks:");
    const allBloodBanks = await BloodBank.find({}).lean();
    allBloodBanks.forEach((bb) => {
      console.log(`  - ${bb.name} (${bb.bloodBanksLocationId})`);
    });
    process.exit(1);
  }

  console.log(`✅ Found blood bank: ${bloodBank.name} (${bloodBank.bloodBanksLocationId})`);

  // Check existing visits
  const existingCount = await TechnicalVisit.countDocuments({
    bloodBankId: bloodBank._id,
  });
  console.log(`Existing visits for this blood bank: ${existingCount}`);

  // Generate example institution IDs (UUIDs)
  const exampleInstitutionIds = [
    "550e8400-e29b-41d4-a716-446655440000",
    "550e8400-e29b-41d4-a716-446655440001",
    "550e8400-e29b-41d4-a716-446655440002",
    "550e8400-e29b-41d4-a716-446655440003",
    "550e8400-e29b-41d4-a716-446655440004",
  ];

  const statuses = ["pending", "approved", "rejected"];

  // Create example visits
  const visits = [];
  const now = new Date();

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

  // Save all visits
  const savedVisits = await TechnicalVisit.insertMany(visits);

  console.log(`\n✅ Created ${savedVisits.length} example technical visits for ${bloodBank.name}`);
  console.log("\nVisits created:");
  savedVisits.forEach((v, i) => {
    console.log(
      `${i + 1}. Institution: ${v.institutionId}, Date: ${v.date.toLocaleDateString("pt-BR")}, Status: ${v.status}`
    );
  });

  await mongoose.disconnect();
  console.log("\n✅ Disconnected from MongoDB");
  process.exit(0);
} catch (error) {
  console.error("Error creating example technical visits:", error);
  await mongoose.disconnect();
  process.exit(1);
}

