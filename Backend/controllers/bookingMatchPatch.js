// controllers/bookingMatchPatch.js
// NOT a new file to keep. Copy the two blocks below into bookingController.js.
// (arr, norm, isAny, loose, socketIdsOf, hasConflict, notify ... already exist there)

/* ======================================================================
   BLOCK 1  ->  replace the whole old `mentorMatches` function
               (the one that starts with:  const mentorMatches = (m, b) => {  )
====================================================================== */

// Set STRICT_MENTOR_MATCH=true in .env to ALSO force the role to match.
const STRICT_MATCH = process.env.STRICT_MENTOR_MATCH === "true";

// Returns "" when this mentor may receive the request, else the reason.
// Hard rules use data every mentor really has: company + gender.
// Spoken language is checked only if the mentor has `spokenLanguages`
// (their `languages` field holds SKILLS like React/Java, not spoken languages).
const whyNot = (m, b) => {
  if (b.companyName && !loose(m.currentCompany, b.companyName)) {
    return `company is "${m.currentCompany}", request needs "${b.companyName}"`;
  }

  // exact compare: loose("male", "female") is TRUE because "female" contains "male"
  if (!isAny(b.gender) && norm(m.gender) !== norm(b.gender)) {
    return `gender is "${m.gender}", request needs "${b.gender}"`;
  }

  const spoken = arr(m.spokenLanguages).map(norm).filter(Boolean);
  if (!isAny(b.language) && spoken.length && !spoken.some((l) => loose(l, b.language))) {
    return `speaks [${spoken.join(", ")}], request needs "${b.language}"`;
  }

  if (STRICT_MATCH && !isAny(b.role)) {
    const target = norm(b.role) === "other" ? b.otherRole : b.role;
    const values = [m.designation, m.department, ...arr(m.skills), ...arr(m.expertise), ...arr(m.languages)];
    if (!isAny(target) && !values.some((v) => loose(v, target))) {
      return `role "${target}" not found in profile`;
    }
  }

  return "";
};

const mentorMatches = (m, b) => whyNot(m, b) === "";

/* ======================================================================
   BLOCK 2  ->  paste this function ABOVE `exports.createRequest`.
               Then inside createRequest delete the whole
                   for (const m of mentors) { ... }
               loop (the one right after `const notified = [];`) and put this ONE line there:

                   await broadcastLoop(req, mentors, booking, payload, startsAt, endsAt, requestGroupId, notified);

               Keep the `if (notified.length) await Booking.updateOne(...)` line after it.
====================================================================== */

const broadcastLoop = async (req, mentors, booking, payload, startsAt, endsAt, requestGroupId, notified) => {
  const report = [];

  for (const m of mentors) {
    const reason =
      whyNot(m, booking) ||
      (socketIdsOf(req.app, m._id).length === 0 ? "not online right now" : "") ||
      ((await hasConflict(m._id, startsAt, endsAt, requestGroupId)) ? "has another session within 30 minutes" : "");

    report.push(`${m.name || m._id}: ${reason || "SENT"}`);
    if (reason) continue;

    notified.push(m._id);
    emitToMentorSockets(req.app, m._id, "session-request", payload);
    notify({
      user: m._id,
      role: "mentor",
      title: "New session request",
      message: `${booking.fresherName} wants a ${booking.durationMinutes}-minute session on ${booking.date} at ${booking.time}.`,
      type: "session",
      link: "/mentor/home",
    });
  }

  // This line tells you EXACTLY why a mentor did or did not get the request
  console.log(`[request ${requestGroupId}] ${mentors.length} approved mentor(s):\n  ${report.join("\n  ") || "none"}`);
};

module.exports = { whyNot, mentorMatches, broadcastLoop };