require("dotenv").config();
const mongoose = require("mongoose");

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  const col = mongoose.connection.db.collection("freshers");

  // refundable = min(walletBalance, totalRefunds)  (cash we really owe)
  // bonus      = rest (welcome + referral mixed; old data cannot be separated)
  const r = await col.updateMany(
    { refundableBalance: { $exists: false } },
    [
      {
        $set: {
          refundableBalance: {
            $min: [{ $ifNull: ["$walletBalance", 0] }, { $ifNull: ["$totalRefunds", 0] }],
          },
        },
      },
      {
        $set: {
          bonusBalance: {
            $max: [0, { $subtract: [{ $ifNull: ["$walletBalance", 0] }, "$refundableBalance"] }],
          },
          referralBalance: 0,
        },
      },
    ],
  );
  console.log("migrated:", r.modifiedCount);
  // walletBalance field-ai DB-la $unset PANNADHA - 1 week verify pannitu apuram pannu
  process.exit(0);
})();