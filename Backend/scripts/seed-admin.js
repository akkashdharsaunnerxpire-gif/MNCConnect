require("dotenv").config();
const mongoose = require("mongoose");
const { seedAdminFromEnv } = require("../controllers/adminController");
const connectDB = require("../config/db");

const seed = async () => {
  try {
    await connectDB();
    await seedAdminFromEnv();
    console.log("✅ Admin seeding complete!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
};

seed();