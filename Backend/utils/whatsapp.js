
// utils/whatsapp.js
// WhatsApp Cloud API - never throws

const GRAPH_VERSION = process.env.WHATSAPP_GRAPH_VERSION || "v21.0";
const GRAPH = `https://graph.facebook.com/${GRAPH_VERSION}`;

const normalizePhone = (value) => {
  const digits = String(value ?? "").replace(/\D/g, "");

  if (digits.length === 10) return `91${digits}`;
  if (digits.length >= 11 && digits.length <= 15) return digits;

  return "";
};

const sendWhatsApp = async ({
  to,
  template,
  params = [],
  lang = process.env.WHATSAPP_LANGUAGE || "en_US",
}) => {
  if (
    String(process.env.WHATSAPP_ENABLED || "false").toLowerCase() !== "true"
  ) {
    return { success: false, error: "WhatsApp disabled" };
  }

  const phone = normalizePhone(to);

  if (!phone) {
    return { success: false, error: "Invalid phone number" };
  }

  if (!process.env.WHATSAPP_TOKEN || !process.env.WHATSAPP_PHONE_ID) {
    return { success: false, error: "WhatsApp credentials missing" };
  }

  if (!template) {
    return { success: false, error: "Template missing" };
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);

    let response;

    try {
      response = await fetch(
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
                          text: String(value ?? ""),
                        })),
                      },
                    ],
                  }
                : {}),
            },
          }),
        },
      );
    } finally {
      clearTimeout(timeout);
    }

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(
        data?.error?.message || `WhatsApp HTTP ${response.status}`,
      );
    }

    const id = data?.messages?.[0]?.id;

    console.log("✅ WhatsApp API accepted:", {
      template,
      messageId: id,
    });

    return {
      success: true,
      id,
    };
  } catch (error) {
    console.error("❌ WhatsApp failed:", error.message);

    return {
      success: false,
      error: error.message,
    };
  }
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
