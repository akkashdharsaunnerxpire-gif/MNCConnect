require("dotenv").config();
const mongoose = require("mongoose");
const Fresher = require("../models/Fresher");

(async () => {
  await mongoose.connect(process.env.MONGO_URI); // unga env key name padi maathunga
  const r = await Fresher.collection.updateMany(
    { welcomeBonusSeen: { $exists: false } },
    { $set: { welcomeBonusSeen: true } }
  );
  console.log("Old users marked as seen:", r.modifiedCount);
  await mongoose.disconnect();
})();