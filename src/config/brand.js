/* Company details and colours used in outgoing emails. Mirrors the website's
   contact details (frontend src/data/site.js) and design tokens (globals.css). */
export const brand = {
  name: "VD Infotech",
  site: (process.env.SITE_URL || "https://www.vdinfotech.in").replace(/\/+$/, ""),
  // Optional PNG/JPG logo for emails (SVG is not shown by most mail clients).
  // When unset the header uses a text wordmark instead.
  logoUrl: process.env.MAIL_LOGO_URL || "",
  email: "info@vdinfotech.in",
  phone: "+91 920-573-1999",
  phoneHref: "+919205731999",
  whatsapp: "919205731999",
  address: "Office No. 505, 5th Floor, CPL Tower 43A, IT Park, Dehradun, Uttarakhand, 248013",
  hours: "Mon – Sat, 9:30 a.m – 6:30 p.m IST",
  colors: {
    red: "#DA0A03",
    redDark: "#920205",
    redTint: "#FDEAE9",
    ink: "#111111",
    inkSoft: "#403F3F",
    grey: "#666666",
    rule: "#E6E6E6",
    canvas: "#F2F2F2",
    offWhite: "#F7F7F7",
    white: "#FFFFFF",
  },
};
