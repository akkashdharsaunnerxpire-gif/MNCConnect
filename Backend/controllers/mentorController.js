const Mentor = require("../models/Mentor");

// GET mentor profile by email
const getMentorProfile = async (req, res) => {
  try {
    console.log("🔥 MENTOR PROFILE GET ROUTE HIT");
    console.log("Request Params:", req.params);

    const email = req.params.mentoremail;
    console.log("📧 Received Email:", email);

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Mentor email is required",
      });
    }

    const mentor = await Mentor.findOne({
      email: email.toLowerCase().trim(),
    }).lean();

    console.log("📦 Mentor DB Data:", mentor);

    if (!mentor) {
      return res.status(404).json({
        success: false,
        message: "Mentor not found",
      });
    }

    return res.status(200).json({
      success: true,
      mentor: mentor,
    });

  } catch (error) {
    console.error("❌ GET MENTOR PROFILE ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch mentor profile",
      error: error.message,
    });
  }
};

// GET mentors by company
const getMentorsByCompany = async (req, res) => {
  try {
    const mentors = await Mentor.find({
      verificationStatus: "approved",
      accountStatus: "active",
    })
      .select(`
        name
        email
        profilePic
        employeeId
        currentCompany
        designation
        department
        officeLocation
        yearsOfExperience
        languages
        bio
        linkedinProfile
        isVerified
        isOnline
      `)
      .sort({
        currentCompany: 1,
        name: 1,
      })
      .lean();

    const companyMap = new Map();

    mentors.forEach((mentor) => {
      const companyName = mentor.currentCompany?.trim();
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

    return res.status(200).json({
      success: true,
      count: companyMap.size,
      companies: Array.from(companyMap.values()),
    });

  } catch (error) {
    console.error("GET COMPANIES ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch companies",
      error: error.message,
    });
  }
};


const UpdateMentorProfile = async (req, res) => {
  try {
    const { mentoremail } = req.params;

    console.log("📧 Update Mentor Email:", mentoremail);
    console.log("📦 Update Data:", req.body);

    const allowedFields = [
      "name",
      "phone",
      "currentCompany",
      "designation",
      "department",
      "officeLocation",
      "yearsOfExperience",
      "languages",
      "bio",
      "linkedinProfile",
      "githubProfile",
      "qualification",
      "education",
      "college",
      "university",
      "skills",
      "expertise",
      "gender",
      "dob",
      "address",
      "city",
    ];

    const updateData = {};

    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        updateData[field] = req.body[field];
      }
    });

    const mentor = await Mentor.findOneAndUpdate(
      {
        email: mentoremail,
      },
      {
        $set: updateData,
      },
      {
        new: true,
        runValidators: true,
      }
    )
      .select(`
        name
        email
        phone
        profilePic
        employeeId
        currentCompany
        designation
        department
        officeLocation
        yearsOfExperience
        languages
        bio
        linkedinProfile
        githubProfile
        qualification
        education
        college
        university
        skills
        expertise
        gender
        dob
        address
        city
        rating
        totalReviews
        totalSessions
        sessionsCompleted
        isVerified
        isOnline
        verificationStatus
        accountStatus
      `)
      .lean();

    if (!mentor) {
      return res.status(404).json({
        success: false,
        message: "Mentor not found",
      });
    }

    console.log("✅ Updated Mentor Data:", mentor);

    return res.status(200).json({
      success: true,
      message: "Mentor profile updated successfully",
      mentor,
    });

  } catch (error) {
    console.error("❌ UPDATE MENTOR ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update mentor profile",
      error: error.message,
    });
  }
};

// ✅ EXPORT both functions
module.exports = {
  getMentorProfile,
  getMentorsByCompany,
  UpdateMentorProfile,
};