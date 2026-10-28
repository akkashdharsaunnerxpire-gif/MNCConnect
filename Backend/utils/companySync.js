// utils/companySync.js
const Company = require("../models/Company");
const Mentor = require("../models/Mentor");

const normalize = (name) => Company.normalize(name);

// "  infosys   ltd " -> "infosys ltd"  (only spacing is cleaned, case is kept)
const cleanDisplay = (name) =>
  String(name || "")
    .trim()
    .replace(/\s+/g, " ");

// All normalized keys a company answers to: current name + old names.
const keysOf = (company) => {
  const keys = new Set();
  [company.name, ...(company.previousNames || [])].forEach((n) => {
    const k = normalize(n);
    if (k) keys.add(k);
  });
  return keys;
};

// ------------------------------------------------------------
// Single company: call this right after a mentor registers.
// - "Infosys", "infosys", "INFOSYS", "Info sys" -> same company
// - renamed companies are matched through previousNames
// - never throws duplicate errors (safe if two mentors register together)
// Returns the Company doc, or null if the name is empty.
// ------------------------------------------------------------
async function ensureCompany(rawName) {
  const name = cleanDisplay(rawName);
  const key = normalize(name);
  if (!key) return null;

  const byName = await Company.findOne({ normalizedName: key });
  if (byName) return byName;

  // renamed company: the registered spelling may be an old name
  const withAliases = await Company.find({
    "previousNames.0": { $exists: true },
  });
  const byAlias = withAliases.find((c) => keysOf(c).has(key));
  if (byAlias) return byAlias;

  try {
    // pre("validate") fills normalizedName
    return await Company.create({ name });
  } catch (err) {
    if (err.code === 11000) {
      return Company.findOne({ normalizedName: key });
    }
    throw err;
  }
}

// ------------------------------------------------------------
// Bulk: creates a Company for every company name that mentors
// already registered with but that has no Company doc yet.
// Safe to run many times (idempotent).
// ------------------------------------------------------------
async function syncCompaniesFromMentors() {
  const [companies, mentors] = await Promise.all([
    Company.find().select("name previousNames").lean(),
    Mentor.find({ accountStatus: { $ne: "rejected" } })
      .select("currentCompany companyName")
      .lean(),
  ]);

  const known = new Set();
  companies.forEach((c) => keysOf(c).forEach((k) => known.add(k)));

  const missing = new Map(); // key -> display name (first spelling wins)

  mentors.forEach((mentor) => {
    [mentor.currentCompany, mentor.companyName].forEach((raw) => {
      const name = cleanDisplay(raw);
      const key = normalize(name);
      if (key && !known.has(key) && !missing.has(key)) {
        missing.set(key, name);
      }
    });
  });

  let created = 0;

  for (const name of missing.values()) {
    try {
      await Company.create({ name });
      created += 1;
    } catch (err) {
      if (err.code !== 11000) throw err; // duplicate = someone else created it
    }
  }

  return created;
}

module.exports = { ensureCompany, syncCompaniesFromMentors };