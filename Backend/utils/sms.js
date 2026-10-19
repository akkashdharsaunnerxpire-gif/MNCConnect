// utils/sms.js
// Twilio SMS helper. It NEVER throws, so an SMS problem can never
// break the approve / reject flow.

let client = null;

const getClient = () => {
  if (client) return client;

  const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN } = process.env;
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) return null;

  try {
    // Loaded lazily so the server still starts even if the package is missing
    const twilio = require("twilio");
    client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
    return client;
  } catch (err) {
    console.error("❌ Twilio package not installed. Run: npm install twilio");
    return null;
  }
};

// Build an E.164 number (+919876543210) from countryCode + mobile
const buildPhone = (countryCode, mobile) => {
  let num = String(mobile || "").replace(/\D/g, "");
  if (!num) return null;

  const cc = String(countryCode || "+91").replace(/\D/g, "") || "91";
  num = num.replace(/^0+/, "");

  // Mobile may already be stored with the country code (e.g. 919876543210)
  if (!(num.startsWith(cc) && num.length > 10)) num = cc + num;

  return num.length >= 8 && num.length <= 15 ? "+" + num : null;
};

// +919876543210 -> +XXXXXXXXXX210
const maskPhone = (to) => String(to || "").replace(/\d(?=\d{3})/g, "X");

const sendSms = async (to, body) => {
  if (String(process.env.SMS_ENABLED || "true").toLowerCase() === "false") {
    return { success: false, error: "SMS is disabled (SMS_ENABLED=false)" };
  }

  const twilioClient = getClient();
  if (!twilioClient) {
    return { success: false, error: "Twilio is not configured" };
  }

  const from = process.env.TWILIO_PHONE_NUMBER;
  const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID;

  if (!from && !messagingServiceSid) {
    return { success: false, error: "TWILIO_PHONE_NUMBER is not set" };
  }

  try {
    const message = await twilioClient.messages.create({
      to,
      body,
      ...(messagingServiceSid ? { messagingServiceSid } : { from }),
    });

    console.log("📩 SMS sent:", message.sid, "to", maskPhone(to));
    return { success: true, sid: message.sid };
  } catch (err) {
    console.error("❌ SMS failed:", err.code, err.message);
    return { success: false, error: err.message };
  }
};

module.exports = { sendSms, buildPhone, maskPhone };