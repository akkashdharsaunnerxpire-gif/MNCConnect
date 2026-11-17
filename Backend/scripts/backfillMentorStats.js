require("dotenv").config();
const mongoose = require("mongoose");
const Mentor = require("../models/Mentor");
const Review = require("../models/Review");
const Booking = require("../models/Booking");

(async () => {
  await mongoose.connect(process.env.MONGO_URI);

  const reviews = await Review.aggregate([
    { $group: { _id: "$mentor", avg: { $avg: "$rating" }, n: { $sum: 1 } } },
  ]);
  for (const r of reviews) {
    await Mentor.updateOne(
      { _id: r._id },
      { $set: { rating: Math.round(r.avg * 10) / 10, totalReviews: r.n } },
    );
  }

  const sessions = await Booking.aggregate([
    { $match: { status: "completed", mentor: { $ne: null } } },
    { $group: { _id: "$mentor", n: { $sum: 1 } } },
  ]);
  for (const s of sessions) {
    await Mentor.updateOne({ _id: s._id }, { $set: { totalSessions: s.n } });
  }

  console.log(`reviews: ${reviews.length} mentors, sessions: ${sessions.length} mentors`);
  process.exit(0);
})();