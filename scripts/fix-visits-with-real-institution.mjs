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
const CollectionRequest = mongoose.model("CollectionRequest", new mongoose.Schema({}, { strict: false }));

try {
  // Get all blood banks
  const bloodBanks = await BloodBank.find({}).lean();

  if (bloodBanks.length === 0) {
    console.error("No blood banks found.");
    process.exit(1);
  }

  // Find HEMORIO
  let targetBloodBank = bloodBanks.find(bb => 
    bb.name?.toLowerCase().includes('hemorio') || 
    bb.slug?.toLowerCase().includes('hemorio')
  );
  
  if (!targetBloodBank) {
    targetBloodBank = bloodBanks[0];
  }

  console.log(`Using blood bank: ${targetBloodBank.name} (${targetBloodBank.bloodBanksLocationId})`);

  // Get all institution IDs from collection requests
  const collectionRequests = await CollectionRequest.find({}).limit(100).lean();
  const allInstitutionIds = [...new Set(collectionRequests.map(cr => cr.institutionId?.toString()).filter(Boolean))];
  
  console.log(`\nFound ${allInstitutionIds.length} institution IDs in collection requests`);
  
  // Try to find which institution actually exists by checking collection requests that have institutionName
  // We'll use the most common one or the first one
  const institutionIdCounts = {};
  collectionRequests.forEach(cr => {
    const instId = cr.institutionId?.toString();
    if (instId) {
      institutionIdCounts[instId] = (institutionIdCounts[instId] || 0) + 1;
    }
  });
  
  // Use the most common institution ID
  const sortedIds = Object.entries(institutionIdCounts).sort((a, b) => b[1] - a[1]);
  const mostCommonInstitutionId = sortedIds[0]?.[0] || allInstitutionIds[0];
  
  console.log(`\nUsing institution ID: ${mostCommonInstitutionId} (used in ${institutionIdCounts[mostCommonInstitutionId]} collection requests)`);

  // Delete all existing visits
  const deleteResult = await TechnicalVisit.deleteMany({});
  console.log(`\n✅ Deleted ${deleteResult.deletedCount} existing visits`);

  // Create only 2 visits for the target blood bank with the real institution ID
  const now = new Date();
  const visits = [];

  // Visit 1: pending, in the future
  const visit1Date = new Date(now);
  visit1Date.setDate(visit1Date.getDate() + 15); // 15 days from now

  visits.push({
    bloodBankId: targetBloodBank._id,
    institutionId: mostCommonInstitutionId,
    date: visit1Date,
    status: "pending",
    createdAt: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000), // 5 days ago
    updatedAt: new Date(),
  });

  // Visit 2: approved, in the past
  const visit2Date = new Date(now);
  visit2Date.setDate(visit2Date.getDate() - 10); // 10 days ago

  visits.push({
    bloodBankId: targetBloodBank._id,
    institutionId: mostCommonInstitutionId,
    date: visit2Date,
    status: "approved",
    createdAt: new Date(now.getTime() - 20 * 24 * 60 * 60 * 1000), // 20 days ago
    updatedAt: new Date(),
  });

  // Save the 2 visits
  const savedVisits = await TechnicalVisit.insertMany(visits);

  console.log(`\n✅ Created ${savedVisits.length} visits for ${targetBloodBank.name}`);
  console.log("\nVisits created:");
  savedVisits.forEach((v, i) => {
    console.log(
      `${i + 1}. Institution ID: ${v.institutionId}, Date: ${v.date.toLocaleDateString("pt-BR")}, Status: ${v.status}`
    );
  });

  await mongoose.disconnect();
  console.log("\n✅ Disconnected from MongoDB");
  process.exit(0);
} catch (error) {
  console.error("Error:", error);
  await mongoose.disconnect();
  process.exit(1);
}

