
export const API_URL =
  import.meta.env.VITE_API_URL || "http://localhost:5000";

const SERVER_ROOT = API_URL.replace(/\/api\/?$/, "").replace(/\/$/, "");

export const normalizeCompanyName = (name = "") =>
  String(name)
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "")
    .replace(/[._-]/g, "");

export const resolveImage = (src) => {
  if (!src) return null;

  if (/^(https?:|data:|blob:)/i.test(src)) {
    return src;
  }

  return `${SERVER_ROOT}${src.startsWith("/") ? "" : "/"}${src}`;
};

const GRADIENTS = [
  "from-violet-200 to-sky-200",
  "from-emerald-200 to-teal-200",
  "from-amber-200 to-rose-200",
  "from-indigo-200 to-fuchsia-200",
  "from-sky-200 to-cyan-200",
];

export const gradientFor = (name = "") => {
  let h = 0;

  for (let i = 0; i < name.length; i += 1) {
    h = (h * 31 + name.charCodeAt(i)) >>> 0;
  }

  return GRADIENTS[h % GRADIENTS.length];
};

// Map current and previous company names to the same admin profile.
export const fetchCompanyProfiles = async () => {
  try {
    const res = await fetch(`${SERVER_ROOT}/company/public`, {
      cache: "no-store",
    });

    if (!res.ok) {
      console.warn("Company profiles request failed:", res.status);
      return {};
    }

    const data = await res.json();
    const map = {};

    (data.companies || []).forEach((company) => {
      const profile = {
        ...company,
        logo: resolveImage(company.logo),
        coverImage: resolveImage(company.coverImage),
      };

      const names = [
        company.name,
        ...(Array.isArray(company.previousNames)
          ? company.previousNames
          : []),
      ];

      names.forEach((name) => {
        const key = normalizeCompanyName(name);

        if (key) {
          map[key] = profile;
        }
      });
    });

    return map;
  } catch (err) {
    console.error("Company profiles fetch error:", err);
    return {};
  }
};
