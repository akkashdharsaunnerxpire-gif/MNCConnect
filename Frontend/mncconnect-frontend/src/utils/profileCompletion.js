// ONE place for the "profile complete" rule.
// Used by: Profile page, Header (ghost hand guide), SessionBoard (booking gate)

export const PROFILE_IMAGE_KEYS = [
  "profilePic",
  "profileImage",
  "avatar",
  "photo",
  "photoUrl",
];

export const REQUIRED_PERCENT = 80;

export const getRawAvatarUrl = (user) => {
  for (const key of PROFILE_IMAGE_KEYS) {
    if (user?.[key]) return user[key];
  }
  return null;
};

const has = (v) => {
  if (Array.isArray(v)) return v.length > 0;
  if (v === null || v === undefined) return false;
  return String(v).trim().length > 0;
};

/**
 * @param user   the /auth/me user object
 * @param opts   { hasPhoto } lets the Profile page count a photo that is still uploading
 * @returns { items, missing, percent, hasPhoto, ok }
 *   ok = photo uploaded AND percent >= 90
 */
export function getProfileStatus(user, { hasPhoto } = {}) {
  const u = user || {};
  const photoDone = hasPhoto ?? Boolean(getRawAvatarUrl(u));

  const items = [
    { key: "photo", label: "Profile photo", done: photoDone },
    { key: "name", label: "Full name", done: has(u.name) },
    {
      key: "phone",
      label: "Phone number",
      done: has(u.phone) || has(u.mobile),
    },
    { key: "gender", label: "Gender", done: has(u.gender) },
    { key: "location", label: "Location", done: has(u.location) },
    { key: "bio", label: "About you", done: has(u.bio) },
    { key: "education", label: "Education", done: has(u.education) },
    { key: "skills", label: "Skills", done: has(u.skills) },
    { key: "interests", label: "Interests", done: has(u.interests) },
    {
      key: "career",
      label: "Career experience (Optional)",
      done: has(u.career),
      required: false,
    },
  ];

  const requiredItems = items.filter(
    (item) => item.required !== false
  );

  const doneCount = requiredItems.filter(
    (item) => item.done
  ).length;

  const percent = Math.round(
    (doneCount / requiredItems.length) * 100
  );

  return {
    items,
    missing: requiredItems.filter((item) => !item.done),
    percent,
    hasPhoto: photoDone,
    ok: photoDone && percent >= REQUIRED_PERCENT,
  };
}

// per-user flag: the ghost hand is shown only until the user opens the Profile page once
export const getGuideKey = (userId) => `mnc_profile_guide_seen_${userId || "me"}`;