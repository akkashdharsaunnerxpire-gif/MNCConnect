const Company = require("../models/Company");
const Mentor = require("../models/Mentor");
const {
  saveCompanyImage,
  removeCompanyImage,
} = require("../utils/companyImages");
const { syncCompaniesFromMentors } = require("../utils/companySync");

const CATEGORIES = [
  "Technology",
  "Finance",
  "Consulting",
  "Product",
  "Design",
  "Marketing",
];

const redirectWith = (res, type, text) =>
  res.redirect(`/admin/companies?${type}=${encodeURIComponent(text)}`);

const normalize = (name) => Company.normalize(name);

// ------------------------------------------------------------
// Helpers
// ------------------------------------------------------------

// Current name + every old name of a company, as normalized keys.
const keysOf = (company) => {
  const keys = new Set();
  [company.name, ...(company.previousNames || [])].forEach((n) => {
    const k = normalize(n);
    if (k) keys.add(k);
  });
  return keys;
};

// Lookup tables over a list of company docs.
// Current names always win over aliases.
const buildLookup = (companies) => {
  const byName = new Map();
  const byAlias = new Map();

  companies.forEach((c) => {
    const nameKey = normalize(c.name);
    if (nameKey) byName.set(nameKey, c);

    (c.previousNames || []).forEach((n) => {
      const k = normalize(n);
      if (k && !byAlias.has(k)) byAlias.set(k, c);
    });
  });

  return {
    byName,
    byAlias,
    find: (key) => (key ? byName.get(key) || byAlias.get(key) || null : null),
  };
};

// ------------------------------------------------------------
// ADMIN: GET /admin/companies
// ------------------------------------------------------------
exports.adminPage = async (req, res) => {
  try {
    // Make sure every company mentors registered with has a Company doc.
    // A failure here must never break the page.
    try {
      await syncCompaniesFromMentors();
    } catch (syncError) {
      console.error("Company sync failed:", syncError.message);
    }

    const companies = await Company.find().sort({ name: 1 }).lean();
    const lookup = buildLookup(companies);

    const mentors = await Mentor.find({
      accountStatus: { $ne: "rejected" },
    })
      .select("currentCompany companyName")
      .lean();

    // canonicalKey -> { doc, mentorIds, spellings }
    const found = new Map();

    mentors.forEach((mentor) => {
      const seenKeys = new Set();

      [mentor.currentCompany, mentor.companyName].forEach((raw) => {
        const spelling = String(raw || "").trim();
        const key = normalize(spelling);

        if (!key || seenKeys.has(key)) return;
        seenKeys.add(key);

        const doc = lookup.find(key);
        const canonicalKey = doc ? String(doc._id) : `unknown:${key}`;

        let entry = found.get(canonicalKey);
        if (!entry) {
          entry = {
            doc,
            mentorIds: new Set(),
            spellings: new Map(),
          };
          found.set(canonicalKey, entry);
        }

        entry.mentorIds.add(String(mentor._id));
        entry.spellings.set(spelling, (entry.spellings.get(spelling) || 0) + 1);
      });
    });

    const rows = [];

    found.forEach((entry) => {
      let name = entry.doc?.name || "";

      if (!name) {
        // fallback (should be rare after sync): most common spelling
        let best = 0;
        entry.spellings.forEach((count, spelling) => {
          if (count > best) {
            best = count;
            name = spelling;
          }
        });
      }

      rows.push({
        name,
        employees: entry.mentorIds.size,
        doc: entry.doc,
      });
    });

    // Admin-created companies that no mentor uses yet
    const listed = new Set(
      rows.filter((r) => r.doc).map((r) => String(r.doc._id))
    );

    companies.forEach((company) => {
      if (!listed.has(String(company._id))) {
        rows.push({ name: company.name, employees: 0, doc: company });
      }
    });

    // Status is based on images:
    //   complete = logo + cover, partial = one of them, new = name only
    rows.forEach((row) => {
      row.hasLogo = Boolean(row.doc?.logo);
      row.hasCover = Boolean(row.doc?.coverImage);

      row.status =
        row.hasLogo && row.hasCover
          ? "complete"
          : row.hasLogo || row.hasCover
            ? "partial"
            : "new";
    });

    const order = { new: 0, partial: 1, complete: 2 };
    rows.sort(
      (a, b) =>
        order[a.status] - order[b.status] || a.name.localeCompare(b.name)
    );

    const stats = {
      total: rows.length,
      complete: rows.filter((r) => r.status === "complete").length,
      partial: rows.filter((r) => r.status === "partial").length,
      isNew: rows.filter((r) => r.status === "new").length,
    };

    res.set("Cache-Control", "no-store");

    return res.render("admin/companies", {
      title: "Companies",
      active: "companies",
      rows,
      stats,
      categories: CATEGORIES,
      msg: req.query.msg || "",
      err: req.query.err || "",
    });
  } catch (error) {
    console.error("Admin companies page error:", error);
    return res.status(500).send("Failed to load companies");
  }
};

// ------------------------------------------------------------
// ADMIN: POST /admin/companies (create / update / rename / merge)
// ------------------------------------------------------------
exports.saveCompany = async (req, res) => {
  const uploadedNow = [];

  try {
    const { id, name, industry, category, originalName } = req.body;

    const cleanName = String(name || "").trim();
    const original = String(originalName || "").trim();

    if (!cleanName) {
      return redirectWith(res, "err", "Company name is required");
    }

    const key = normalize(cleanName);
    const originalKey = normalize(original);

    // The company list is small, so resolve everything in memory.
    const companies = await Company.find();
    const lookup = buildLookup(companies);

    // 1) exact doc chosen in the form
    // 2) a company already using the typed name (merge into it)
    // 3) a company that owned the original spelling
    let doc =
      (id && companies.find((c) => String(c._id) === String(id))) ||
      lookup.find(key) ||
      lookup.find(originalKey) ||
      null;

    const isNew = !doc;
    const previousName = isNew ? "" : String(doc.name || "").trim();

    if (isNew) doc = new Company({ name: cleanName });

    // The typed name must not belong to a different company
    const clash = companies.find(
      (c) => String(c._id) !== String(doc._id) && keysOf(c).has(key)
    );

    if (clash) {
      return redirectWith(res, "err", `"${clash.name}" already exists`);
    }

    // ---- alias handling ----
    // Keep: old aliases + the profile's previous name + the spelling
    // that mentors registered with. All of them now point to this company.
    const aliases = new Map(
      (doc.previousNames || []).map((n) => [normalize(n), String(n).trim()])
    );

    [previousName, original].forEach((candidate) => {
      const k = normalize(candidate);
      if (!k || k === key) return;

      const ownedByOther = companies.some(
        (c) => String(c._id) !== String(doc._id) && keysOf(c).has(k)
      );

      if (!ownedByOther) aliases.set(k, candidate);
    });

    aliases.delete(key); // current name is never its own alias

    doc.previousNames = [...aliases.values()];
    doc.name = cleanName;
    doc.normalizedName = key;

    if (industry !== undefined && String(industry).trim()) {
      doc.industry = String(industry).trim();
    }

    if (category !== undefined && CATEGORIES.includes(category)) {
      doc.category = category;
    }

    // ---- images ----
    const logoFile = req.files?.logo?.[0];
    const coverFile = req.files?.coverImage?.[0];

    const oldLogoId = doc.logoPublicId;
    const oldCoverId = doc.coverPublicId;

    if (logoFile) {
      const upload = await saveCompanyImage(logoFile.buffer, "logo", key);
      uploadedNow.push(upload.publicId);
      doc.logo = upload.url;
      doc.logoPublicId = upload.publicId;
    }

    if (coverFile) {
      const upload = await saveCompanyImage(coverFile.buffer, "cover", key);
      uploadedNow.push(upload.publicId);
      doc.coverImage = upload.url;
      doc.coverPublicId = upload.publicId;
    }

    await doc.save();

    // Delete replaced Cloudinary images only after DB save succeeded
    if (logoFile && oldLogoId && oldLogoId !== doc.logoPublicId) {
      await removeCompanyImage(oldLogoId);
    }
    if (coverFile && oldCoverId && oldCoverId !== doc.coverPublicId) {
      await removeCompanyImage(oldCoverId);
    }

    return redirectWith(res, "msg", `${doc.name} saved`);
  } catch (error) {
    console.error("Save company error:", error);

    await Promise.all(
      uploadedNow.map(async (publicId) => {
        try {
          await removeCompanyImage(publicId);
        } catch (cleanupError) {
          console.error("Cloudinary cleanup error:", cleanupError);
        }
      })
    );

    return redirectWith(
      res,
      "err",
      error.code === 11000
        ? "A company with this normalized name already exists"
        : error.message || "Failed to save company"
    );
  }
};

// ------------------------------------------------------------
// ADMIN: POST /admin/companies/:id/delete
// ------------------------------------------------------------
exports.deleteCompany = async (req, res) => {
  try {
    const doc = await Company.findByIdAndDelete(req.params.id);

    if (doc) {
      await removeCompanyImage(doc.logoPublicId);
      await removeCompanyImage(doc.coverPublicId);
    }

    return redirectWith(
      res,
      "msg",
      doc ? `${doc.name} deleted` : "Company not found"
    );
  } catch (error) {
    console.error("Delete company error:", error);
    return redirectWith(res, "err", "Failed to delete company");
  }
};

// ------------------------------------------------------------
// PUBLIC: GET /company/public
// ------------------------------------------------------------
exports.publicList = async (req, res) => {
  try {
    const companies = await Company.find()
      .select("name previousNames logo coverImage industry category -_id")
      .lean();

    res.set("Cache-Control", "no-store");
    return res.json({ companies });
  } catch (error) {
    console.error("Public companies error:", error);
    return res.status(500).json({
      message: "Failed to load company profiles",
    });
  }
};