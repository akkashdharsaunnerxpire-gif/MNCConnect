// utils/phone.js
// ONE phone rule for fresher, mentor and profile edits.
// Stored format everywhere:  mobile = "+919876543210"   countryCode = "+91"
const parsePhone = (countryCode, mobile) => {
  let code = String(countryCode || "+91").trim().replace(/\s+/g, "");
  if (!code.startsWith("+")) code = `+${code}`;
  if (!/^\+\d{1,4}$/.test(code)) {
    return { error: "Please provide a valid country code (e.g., +91)." };
  }

  let raw = String(mobile || "").replace(/[\s\-().]/g, "");
  if (raw.startsWith(code)) raw = raw.slice(code.length);
  let national = raw.replace(/\D/g, "");

  if (code === "+91") {
    if (national.length === 12 && national.startsWith("91")) national = national.slice(2);
    else if (national.length === 11 && national.startsWith("0")) national = national.slice(1);
    if (!/^\d{10}$/.test(national)) {
      return { error: "Indian mobile number must be exactly 10 digits." };
    }
  } else if (national.length < 6 || code.length - 1 + national.length > 15) {
    return { error: "Please provide a valid mobile number for the selected country." };
  }

  return { code, national, full: `${code}${national}` };
};

module.exports = { parsePhone };