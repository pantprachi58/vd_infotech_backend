/* Every website form the API accepts, keyed by the id in POST /api/forms/:id.

   mailbox  which Hostinger mailbox sends the email and receives it
            (config/mailboxes.js: lead | consult | form | career)
   source   the form's name as visitors see it — quoted in the team email
   team     the notification to the team
   ack      the confirmation sent to the visitor (from the same mailbox)
   fields   validation + email rows, in display order (forms/validate.js)

   Adding a form = adding an entry here and posting to /app-api/forms/<id>.  */

const CONTACT = "Contact details";
const PROJECT = "Project details";
const SLOT = "Requested slot";

const contactFields = [
  { key: "name", label: "Name", required: true, max: 120, group: CONTACT },
  { key: "email", label: "Email", type: "email", required: true, group: CONTACT },
  { key: "phone", label: "Phone", type: "phone", required: true, group: CONTACT },
];

export const FORMS = {
  /* Home page popup — "Let's Get Your Project Started". */
  "project-enquiry": {
    mailbox: "lead",
    source: "Let's Get Your Project Started",
    team: {
      eyebrow: "New lead",
      title: "New Project Enquiry",
      subject: (d) => `New Project Enquiry – ${d.name}${d.company ? ` (${d.company})` : ""}`,
    },
    ack: {
      subject: "We've received your project enquiry – VD Infotech",
      title: "Thanks for reaching out!",
      intro: (d) =>
        `Hi ${d.firstName},\n\nThank you for telling us about your project. A growth specialist from our team is reviewing your requirements and will get back to you within one business day with the next steps.`,
    },
    fields: [
      ...contactFields,
      { key: "company", label: "Company", max: 160, group: CONTACT },
      { key: "services", label: "Services", type: "list", required: true, requiredMessage: "Please select at least one service.", group: PROJECT },
      { key: "budget", label: "Budget", required: true, max: 80, group: PROJECT },
      { key: "message", label: "Project details", type: "longtext", group: PROJECT },
    ],
  },

  /* Header "Book an Appointment", hero CTA and Connect With Us "Pick a Time"
     — the "Get a Free 10-Min Strategy Call" modal. */
  "strategy-call": {
    mailbox: "lead",
    source: "Book an Appointment – Free Strategy Call",
    team: {
      eyebrow: "Appointment request",
      title: "New Strategy Call Request",
      subject: (d) => `Appointment Request – ${d.name} (${d.preferredDate})`,
    },
    ack: {
      subject: "Your free strategy call request – VD Infotech",
      title: "Your call request is in!",
      intro: (d) =>
        `Hi ${d.firstName},\n\nThanks for booking a free strategy call with VD Infotech. We've noted ${d.preferredDate} as your preferred date — our team will confirm the exact time with you by email or phone shortly.`,
    },
    fields: [
      ...contactFields,
      { key: "service", label: "Interested service", required: true, max: 120, group: PROJECT },
      { key: "budget", label: "Project budget", max: 80, group: PROJECT },
      { key: "projectType", label: "Project type", required: true, max: 80, group: PROJECT },
      { key: "message", label: "About the project", type: "longtext", required: true, group: PROJECT },
      { key: "preferredDate", label: "Preferred date", required: true, max: 80, group: SLOT },
      { key: "duration", label: "Call length", max: 40, group: SLOT },
      { key: "newsletter", label: "Newsletter", type: "boolean", group: SLOT },
      {
        key: "attachment",
        label: "Attachment",
        type: "file",
        accept: [".jpg", ".jpeg", ".png", ".pdf"],
        maxBytes: 4 * 1024 * 1024,
        group: PROJECT,
      },
    ],
  },

  /* Personalized Business Growth Consultation — "Book Your Strategy Session". */
  consultation: {
    mailbox: "consult",
    source: "Book Your Strategy Session",
    team: {
      eyebrow: "Consultation",
      title: "New Strategy Session Booking",
      subject: (d) => `Strategy Session Request – ${d.name} (${d.date})`,
    },
    ack: {
      subject: "Your strategy session request – VD Infotech",
      title: "Your strategy session is requested",
      intro: (d) =>
        `Hi ${d.firstName},\n\nThank you for booking a strategy session with VD Infotech for ${d.date}, ${d.time}.\n\nBefore we meet, our team studies your business, competitors and current digital presence so the session is about your growth — not a generic pitch. We'll email you shortly to confirm the slot and share the Google Meet link.`,
    },
    fields: [
      ...contactFields,
      { key: "company", label: "Company", max: 160, group: CONTACT },
      { key: "date", label: "Date", required: true, max: 80, group: SLOT },
      { key: "time", label: "Time", required: true, max: 120, group: SLOT },
      { key: "ist", label: "In IST", max: 120, group: SLOT },
      { key: "duration", label: "Duration", required: true, max: 40, group: SLOT },
      { key: "message", label: "Notes", type: "longtext", group: PROJECT },
    ],
  },

  /* Service & sub-service banner form (top right) — ContactForm. */
  "service-enquiry": {
    mailbox: "consult",
    source: "Service Enquiry",
    team: {
      eyebrow: "Service enquiry",
      title: "New Service Enquiry",
      subject: (d) => `Service Enquiry – ${d.need} – ${d.name}${d.company ? ` (${d.company})` : ""}`,
    },
    ack: {
      subject: "We've received your enquiry – VD Infotech",
      title: "Thanks for your enquiry!",
      intro: (d) =>
        `Hi ${d.firstName},\n\nThank you for your interest in our ${d.need} services. A consultant from our team is reviewing your project details and will get back to you within one business day${d.nda ? " — we'll share our NDA before we discuss specifics" : ""}.`,
    },
    fields: [
      ...contactFields,
      { key: "company", label: "Company", max: 160, group: CONTACT },
      { key: "need", label: "Service needed", required: true, max: 160, group: PROJECT },
      { key: "budget", label: "Budget range", max: 80, group: PROJECT },
      { key: "message", label: "About the project", type: "longtext", required: true, group: PROJECT },
      { key: "nda", label: "NDA requested", type: "boolean", group: PROJECT },
      { key: "topic", label: "Enquiry type", max: 160, group: PROJECT, internal: true },
    ],
  },

  /* Closing CTA band — "Start My Growth Journey" (home FinalCta) and the
     "Grow Your Business" band (ServiceCta) on service, sub-service and other pages. */
  "growth-journey": {
    mailbox: "form",
    source: "Start My Growth Journey",
    team: {
      eyebrow: "Website form",
      title: "New Growth Journey Request",
      subject: (d) => `${d.topic || "Growth Journey Request"} – ${d.name}`,
    },
    ack: {
      subject: "Let's grow your business – VD Infotech",
      title: "Your growth journey starts here",
      intro: (d) =>
        `Hi ${d.firstName},\n\nThanks for getting in touch with VD Infotech. One of our growth strategists will review ${d.website ? "your website and " : ""}your details and reach out within one business day to understand your goals.`,
    },
    fields: [
      ...contactFields,
      { key: "website", label: "Website", type: "url", group: CONTACT },
      // Set by the page, not typed by the visitor: what the band is about.
      { key: "topic", label: "Enquiry type", max: 160, group: PROJECT, internal: true },
      { key: "details", label: "Context", type: "list", group: PROJECT, internal: true },
    ],
  },
};

/* Careers pages and the apply dialog — CareerApplyForm. */
FORMS["job-application"] = {
  mailbox: "career",
  source: "Job Application",
  team: {
    eyebrow: "Job application",
    title: "New Job Application",
    subject: (d) => `Job Application – ${d.role} – ${d.name}`,
  },
  ack: {
    subject: "We've received your application – VD Infotech",
    title: "Thanks for applying!",
    intro: (d) =>
      `Hi ${d.firstName},\n\nThank you for applying for the ${d.role} role at VD Infotech. Our hiring team reviews every application carefully — if your profile is a good match, we'll contact you to arrange the next step.`,
  },
  fields: [
    ...contactFields,
    { key: "role", label: "Role", required: true, max: 160, group: "Application" },
    { key: "experience", label: "Experience", max: 80, group: "Application" },
    { key: "resumeLink", label: "Resume / portfolio link", type: "url", group: "Application" },
    {
      key: "resumeFile",
      label: "Resume",
      type: "file",
      accept: [".pdf", ".doc", ".docx"],
      maxBytes: 5 * 1024 * 1024,
      group: "Application",
    },
    { key: "message", label: "About the candidate", type: "longtext", group: "Application" },
  ],
};

/* Blog pages — BlogNewsletter. */
FORMS.newsletter = {
  mailbox: "form",
  source: "Blog Newsletter",
  team: {
    eyebrow: "Newsletter",
    title: "New Newsletter Subscriber",
    subject: (d) => `Newsletter Sign-up – ${d.email}`,
  },
  ack: {
    subject: "You're subscribed – VD Infotech Insights",
    title: "Welcome aboard!",
    intro: () =>
      "Hi there,\n\nThanks for subscribing to the VD Infotech newsletter. You'll receive our latest articles on digital marketing, technology, AI and growth — practical ideas you can put to work in your business.\n\nIf you didn't sign up, simply reply to this email and we'll remove your address.",
  },
  fields: [{ key: "email", label: "Email", type: "email", required: true, group: "Subscriber" }],
};

export const getForm =(id) => (Object.hasOwn(FORMS, id) ? { id, ...FORMS[id] } : null);
