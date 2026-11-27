/* Validates a form submission against its field list (forms/definitions.js).

   Field shape: { key, label, type, required, max, group }
     text | longtext | email | phone | url  → trimmed string
     list                                   → array of short strings
     boolean                                → true / false
     file                                   → { name, type, data(base64) }, see `accept` / `maxBytes`

   Returns { data, errors }: `data` holds only the declared keys, `errors` is
   null or { key: message } for the form to show next to the field.          */

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE = /^\+?[0-9][0-9 ()\-]{5,19}$/;
const DEFAULT_MAX = { text: 200, longtext: 3000, email: 200, phone: 24, url: 300 };
const LIST_MAX_ITEMS = 25;
const LIST_ITEM_MAX = 120;

// Magic bytes per extension: the file's own bytes decide its type.
const SIGNATURES = {
  ".pdf": (b) => b.toString("ascii", 0, 5) === "%PDF-",
  ".png": (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  ".jpg": (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  ".jpeg": (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  ".docx": (b) => b[0] === 0x50 && b[1] === 0x4b && b[2] === 0x03 && b[3] === 0x04, // zip container
  ".doc": (b) => b.subarray(0, 8).equals(Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])), // OLE
};
export const MIME = {
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

const str = (v) => (typeof v === "string" ? v.trim() : typeof v === "number" ? String(v) : "");

function readFile(field, raw) {
  if (!raw || typeof raw !== "object") return { error: `${field.label} is not a valid file` };
  const name = str(raw.name).replace(/[\\/\r\n"]/g, "_").slice(0, 120);
  const ext = (/\.[^.]+$/.exec(name)?.[0] ?? "").toLowerCase();
  if (!field.accept.includes(ext)) return { error: `Only ${field.accept.join(", ")} files are allowed` };

  const base64 = str(raw.data).replace(/^data:[^;]+;base64,/, "");
  if (!base64 || !/^[A-Za-z0-9+/]+={0,2}$/.test(base64)) return { error: `${field.label} could not be read` };
  const content = Buffer.from(base64, "base64");
  if (!content.length) return { error: `${field.label} is empty` };
  if (content.length > field.maxBytes) return { error: `${field.label} must be ${Math.round(field.maxBytes / 1048576)}MB or smaller` };
  if (!SIGNATURES[ext]?.(content)) return { error: `${field.label} doesn't look like a real ${ext} file` };

  return { value: { filename: name, ext, content, contentType: MIME[ext], size: content.length } };
}

export function validate(fields, body) {
  const data = {};
  const errors = {};

  for (const field of fields) {
    const { key, label, type = "text", required = false } = field;
    const raw = body[key];

    if (type === "boolean") {
      data[key] = raw === true || raw === "true" || raw === "on";
      continue;
    }

    if (type === "list") {
      const items = (Array.isArray(raw) ? raw : raw ? [raw] : []).map(str).filter(Boolean);
      if (required && !items.length) errors[key] = field.requiredMessage ?? `Please choose at least one option for ${label}`;
      else if (items.length > LIST_MAX_ITEMS || items.some((s) => s.length > LIST_ITEM_MAX)) errors[key] = `${label} has too many entries`;
      data[key] = [...new Set(items)];
      continue;
    }

    if (type === "file") {
      if (raw == null || raw === "") {
        if (required) errors[key] = `${label} is required`;
        continue;
      }
      const { value, error } = readFile(field, raw);
      if (error) errors[key] = error;
      else data[key] = value;
      continue;
    }

    let value = str(raw);
    const max = field.max ?? DEFAULT_MAX[type] ?? 200;
    if (!value) {
      if (required) errors[key] = `${label} is required`;
      data[key] = "";
      continue;
    }
    if (value.length > max) errors[key] = `${label} is too long (max ${max} characters)`;
    else if (type === "email" && !EMAIL.test(value)) errors[key] = "Enter a valid email address";
    else if (type === "phone" && !PHONE.test(value)) errors[key] = "Enter a valid phone number";
    else if (type === "url") {
      if (!/^https?:\/\//i.test(value)) value = `https://${value}`;
      try {
        const url = new URL(value);
        if (!url.hostname.includes(".")) throw new Error();
      } catch {
        errors[key] = "Enter a valid website address";
      }
    }
    data[key] = value;
  }

  return { data, errors: Object.keys(errors).length ? errors : null };
}
