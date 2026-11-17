require("dotenv").config();
const mongoose = require("mongoose");
const Mentor = require("../models/Mentor");
const Fresher = require("../models/Fresher");

(async () => {
  await mongoose.connect(process.env.MONGO_URI);

  for (const [label, Model] of [["mentor", Mentor], ["fresher", Fresher]]) {
    // updateOne does not run validators, so the old regex cannot block this
    const docs = await Model.find({ mobile: { $not: /^\+/ } })
      .select("mobile countryCode name")
      .lean();

    let fixed = 0;
    for (const d of docs) {
      if (d.name === "Temp") continue;
      const digits = String(d.mobile || "").replace(/\D/g, "");
      if (!digits) continue;
      const code = d.countryCode || "+91";
      const national =
        code === "+91" && digits.length === 12 && digits.startsWith("91")
          ? digits.slice(2)
          : digits;
      try {
        await Model.updateOne({ _id: d._id }, { $set: { mobile: `${code}${national}` } });
        fixed += 1;
      } catch (e) {
        console.log(`${label} ${d._id}: skipped (${e.message})`);
      }
    }
    console.log(`${label}: ${fixed}/${docs.length} normalized`);
  }
  process.exit(0);
})();