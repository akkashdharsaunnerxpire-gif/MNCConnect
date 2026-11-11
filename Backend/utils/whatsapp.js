// utils/whatsapp.js
// WhatsApp Cloud API - never throws

const GRAPH_VERSION = process.env.WHATSAPP_GRAPH_VERSION || "v21.0";
const GRAPH = `https://graph.facebook.com/${GRAPH_VERSION}`;

// ---------- helpers ----------

// "+91 98765-43210", "09876543210", "0091 98765 43210" -> "919876543210"
const normalizePhone = (value) => {
  let digits = String(value ?? "").replace(/\D/g, "");

  if (digits.startsWith("00")) digits = digits.slice(2); // 0091...
  if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1); // 098...
  if (digits.length === 13 && digits.startsWith("091")) digits = digits.slice(1);

  if (digits.length === 10) return `91${digits}`;
  if (digits.length >= 11 && digits.length <= 15) return digits;

  return "";
};

// Meta rejects empty params, newlines, tabs and 4+ consecutive spaces
const cleanParam = (value) => {
  const text = String(value ?? "")
    .replace(/[\r\n\t]+/g, " ")
    .replace(/ {2,}/g, " ")
    .trim()
    .slice(0, 1000);
  return text || "-";
};

const maskPhone = (p) => (p.length > 4 ? `${"*".repeat(p.length - 4)}${p.slice(-4)}` : p);

const isEnabled = () =>
  String(process.env.WHATSAPP_ENABLED || "false").toLowerCase() === "true";

// short human hint for the most common Meta errors
const hintFor = (code, message = "") => {
  const m = String(message).toLowerCase();
  if (code === 190 || m.includes("access token"))
    return "Access token expired/invalid. Use a permanent System User token.";
  if (code === 132001)
    return "Template name/language not found. Check WHATSAPP_LANGUAGE and the template name.";
  if (code === 132000)
    return "Template params count mismatch. Template needs exactly 4 body params.";
  if (code === 132012) return "Template param format mismatch.";
  if (code === 131030)
    return "Recipient not in allowed list (test number). Add it in Meta > API Setup.";
  if (code === 131026) return "Recipient cannot receive message (not on WhatsApp / blocked).";
  if (code === 131047 || code === 131049)
    return "Meta refused delivery (re-engagement / marketing limit).";
  if (code === 100) return "Invalid parameter. Check phone id, template params.";
  if (code === 10 || code === 200) return "Permission missing: whatsapp_business_messaging.";
  return "";
};

class WhatsAppError extends Error {
  constructor(message, code, details) {
    super(message);
    this.code = code;
    this.details = details;
  }
}

// one call to Graph API
const postTemplate = async ({ phone, template, lang, params }) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);

  try {
    const response = await fetch(
      `${GRAPH}/${process.env.WHATSAPP_PHONE_ID}/messages`,
      {
        method: "POST",
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: phone,
          type: "template",
          template: {
            name: template,
            language: { code: lang },
            ...(params.length
              ? {
                  components: [
                    {
                      type: "body",
                      parameters: params.map((value) => ({
                        type: "text",
                        text: cleanParam(value),
                      })),
                    },
                  ],
                }
              : {}),
          },
        }),
      },
    );

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      const err = data?.error || {};
      throw new WhatsAppError(
        err.message || `WhatsApp HTTP ${response.status}`,
        err.code,
        err.error_data?.details || err.error_user_msg || "",
      );
    }

    return data;
  } catch (error) {
    if (error.name === "AbortError")
      throw new WhatsAppError("WhatsApp request timed out", "TIMEOUT");
    throw error;
  } finally {
    clearTimeout(timeout);
  }
};

// ---------- public sender ----------

const sendWhatsApp = async ({
  to,
  template,
  params = [],
  lang = process.env.WHATSAPP_LANGUAGE || "en_US",
}) => {
  if (!isEnabled()) {
    console.warn("⚠️ WhatsApp skipped: WHATSAPP_ENABLED is not 'true'");
    return { success: false, error: "WhatsApp disabled" };
  }

  const phone = normalizePhone(to);

  if (!phone) {
    console.warn("⚠️ WhatsApp skipped: invalid phone number ->", to);
    return { success: false, error: "Invalid phone number" };
  }

  if (!process.env.WHATSAPP_TOKEN || !process.env.WHATSAPP_PHONE_ID) {
    console.error("❌ WhatsApp credentials missing (WHATSAPP_TOKEN / WHATSAPP_PHONE_ID)");
    return { success: false, error: "WhatsApp credentials missing" };
  }

  if (!template) {
    return { success: false, error: "Template missing" };
  }

  // if the configured language is not found (132001), try common fallbacks once
  const languages = [...new Set([lang, "en", "en_US"])];

  let lastError;

  for (const code of languages) {
    try {
      const data = await postTemplate({ phone, template, lang: code, params });
      const id = data?.messages?.[0]?.id;

      console.log("✅ WhatsApp API accepted:", {
        to: maskPhone(phone),
        template,
        lang: code,
        messageId: id,
        note: "Accepted != delivered. Check Meta webhook/status if user did not receive.",
      });

      return { success: true, id };
    } catch (error) {
      lastError = error;
      // only a language problem is worth retrying with another language
      if (error.code !== 132001) break;
      console.warn(`⚠️ Template "${template}" not found in "${code}", trying next language...`);
    }
  }

  const hint = hintFor(lastError?.code, lastError?.message);
  console.error("❌ WhatsApp failed:", {
    to: maskPhone(phone),
    template,
    code: lastError?.code,
    message: lastError?.message,
    details: lastError?.details,
    hint,
  });

  return {
    success: false,
    error: `${lastError?.message || "WhatsApp failed"}${hint ? ` | ${hint}` : ""}`,
  };
};

// Approved Meta template must have exactly four BODY placeholders:
// {{1}} First name
// {{2}} Date
// {{3}} Time
// {{4}} Meeting URL

const sendSessionWhatsApp = ({
  kind = "booked",
  to,
  name,
  date,
  time,
  meetingUrl,
}) =>
  sendWhatsApp({
    to,
    template:
      kind === "reminder"
        ? process.env.WHATSAPP_REMINDER_TEMPLATE || "session_room_open"
        : process.env.WHATSAPP_BOOKED_TEMPLATE || "session_booked",

    params: [
      String(name || "there").trim().split(/\s+/)[0],
      date,
      time,
      meetingUrl,
    ],
  });

module.exports = {
  normalizePhone,
  sendWhatsApp,
  sendSessionWhatsApp,
};