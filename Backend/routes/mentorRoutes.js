const express = require("express");
const router = express.Router();

const Mentor = require("../models/Mentor");

router.get("/companies", async (req, res) => {
  try {
    const mentors = await Mentor.find({
      verificationStatus: "approved",
      accountStatus: "active",
    })
      .select(
        "name email profilePic employeeId currentCompany designation department officeLocation yearsOfExperience languages bio linkedinProfile isVerified"
      )
      .sort({
        currentCompany: 1,
        name: 1,
      })
      .lean();

    const companyMap = new Map();

    mentors.forEach((mentor) => {
      const companyName =
        mentor.currentCompany?.trim();

      if (!companyName) return;

      const key = companyName.toLowerCase();

      if (!companyMap.has(key)) {
        companyMap.set(key, {
          companyName,
          logo: "",
          mentorCount: 0,
          onlineCount: 0,
          mentors: [],
        });
      }

      const company = companyMap.get(key);

      company.mentorCount++;

      if (mentor.isOnline === true) {
        company.onlineCount++;
      }

      company.mentors.push(mentor);
    });

    res.status(200).json({
      success: true,
      count: companyMap.size,
      companies: Array.from(
        companyMap.values()
      ),
    });

  } catch (error) {
    console.error(
      "GET COMPANIES ERROR:",
      error
    );

    res.status(500).json({
      success: false,
      message: "Failed to fetch companies",
    });
  }
});

module.exports = router;