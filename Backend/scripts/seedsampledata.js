
require("dotenv").config();

const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const MONGO_URI =
  process.env.MONGODB_URI ||
  process.env.MONGO_URI;

const companies = [
  {
    name: "TCS",
    prefix: "TCS",
    domain: "tcs.example.invalid",
    location: "Chennai, India",
  },
  {
    name: "Infosys",
    prefix: "INF",
    domain: "infosys.example.invalid",
    location: "Bengaluru, India",
  },
  {
    name: "Wipro",
    prefix: "WIP",
    domain: "wipro.example.invalid",
    location: "Hyderabad, India",
  },
  {
    name: "Accenture",
    prefix: "ACC",
    domain: "accenture.example.invalid",
    location: "Mumbai, India",
  },
  {
    name: "Cognizant",
    prefix: "COG",
    domain: "cognizant.example.invalid",
    location: "Coimbatore, India",
  },
];

const people = [
  {
    name: "Arun Kumar",
    designation: "Software Engineer",
    department: "Engineering",
    gender: "male",
    languages: ["React", "Java"],
    skills: ["React", "Java"],
  },
  {
    name: "Priya Sharma",
    designation: "Frontend Developer",
    department: "Engineering",
    gender: "female",
    languages: ["JavaScript", "React"],
    skills: ["JavaScript", "React", "CSS"],
  },
  {
    name: "Rahul Verma",
    designation: "Backend Developer",
    department: "Engineering",
    gender: "male",
    languages: ["Node.js", "MongoDB"],
    skills: ["Node.js", "Express", "MongoDB"],
  },
  {
    name: "Divya Nair",
    designation: "QA Engineer",
    department: "Quality Assurance",
    gender: "female",
    languages: ["Java", "Python"],
    skills: ["Testing", "Selenium", "Java"],
  },
  {
    name: "Karthik Raj",
    designation: "Tech Lead",
    department: "Engineering",
    gender: "male",
    languages: ["Python", "SQL"],
    skills: ["Python", "SQL", "System Design"],
  },
];

async function seedEmployees() {
  try {
    if (!MONGO_URI) {
      throw new Error(
        "MongoDB URI missing. Check MONGODB_URI or MONGO_URI in .env"
      );
    }

    await mongoose.connect(MONGO_URI);

    console.log("MongoDB connected successfully.");

    const now = new Date();

    // Shared test password for these sample accounts.
    // Change it before using any account outside local testing.
    const passwordHash = await bcrypt.hash(
      "Test@12345",
      12
    );

    const docs = [];

    companies.forEach((company, companyIndex) => {
      people.forEach((person, personIndex) => {
        const number = companyIndex * 5 + personIndex + 1;
        const id = String(number).padStart(4, "0");
        const emailId = String(number).padStart(2, "0");

        docs.push({
          name: person.name,

          email: `employee${emailId}@example.invalid`,
          countryCode: "+91",
          mobile: `+9190000000${String(number).padStart(2, "0")}`,

          password: passwordHash,

          profilePic: "",
          employeeId: `${company.prefix}-${id}`,
          workEmail: `employee${emailId}@${company.domain}`,
          linkedinProfile: "",

          yearsOfExperience: personIndex + 1,
          currentCompany: company.name,
          designation: person.designation,
          gender: person.gender,
          department: person.department,
          officeLocation: company.location,

          languages: person.languages,
          hourlyRate: 0,

          bio: `Sample ${person.designation} profile at ${company.name}.`,

          offerLetter: "",
          employeeIdProof: "",
          additionalProof: "",

          isVerified: false,
          verificationStatus: "pending",
          verificationMethod: "document",
          accountStatus: "active",

          lastLoginAt: null,
          rejectionReason: "",

          offerLetterPublicId: "",
          employeeIdProofPublicId: "",
          additionalProofPublicId: "",

          skills: person.skills,

          createdAt: now,
          updatedAt: now,
          __v: 0,
        });
      });
    });

    // Uses the existing "mentors" MongoDB collection.
    // This inserts raw documents, so Mongoose schema validation
    // and middleware will not run.
    const collection =
      mongoose.connection.db.collection("mentors");

    const result = await collection.insertMany(docs);

    console.log(
      `Successfully inserted ${result.insertedCount} sample profiles.`
    );

    console.log("Company-wise count:");

    for (const company of companies) {
      console.log(`${company.name}: 5 profiles`);
    }

    console.log("Test password: Test@12345");
  } catch (error) {
    console.error("Seeding failed:", error.message);
  } finally {
    await mongoose.disconnect();
    console.log("MongoDB connection closed.");
  }
}

seedEmployees();
