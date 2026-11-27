/* =============================================================================
   REBRAND THIS SITE HERE
   -----------------------------------------------------------------------------
   Change the business name, colors, phone number, services, and wording in
   this file only. You do not need to edit the other files for a typical
   client, or later for your own service site.

   FORM_ENDPOINT: leave this as an empty string while you are testing. The
   form will show a friendly thank-you message and will not send anything.
   Later, paste the Apps Script web app /exec URL here to collect real
   inquiries. See WEBAPP-SETUP.md and the comments on FORM_ENDPOINT below.
   ============================================================================= */

const SITE = {
  name: "Tulip City Lawn Care",
  city: "Holland, Michigan",
  tagline: "Reliable lawn care in Holland, Michigan",

  /* Placeholder contact info only — not a real business */
  phone: "(616) 555-0148",
  phoneHref: "tel:+16165550148",
  email: "hello@example.com",

  /*
    Leave "" for now. The form will thank the visitor and stay on this page.
    When the Apps Script web app is deployed, paste the Web app URL here,
    such as:
      https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec
    That URL comes from Deploy > New deployment > Web app in the script
    bound to the leads spreadsheet. See WEBAPP-SETUP.md in the lead-demo folder.
    Keep FORM_FIELD_MAP values in sync with the field names in WebApp.gs.
  */
  FORM_ENDPOINT: "https://script.google.com/macros/s/AKfycbys6hDRRS53D1L5nwFGL6-9aemTpJYI1GQngWGU8yrXibYsbRjl3unhp1UQnIHjdylX/exec",

  FORM_FIELD_MAP: {
    name: "Full name",
    email: "Email",
    phone: "Phone",
    service: "Service needed",
    message: "Message",
  },

  /* Fresh green palette. These become CSS variables automatically. */
  colors: {
    forest: "#1E3A2F",
    "forest-deep": "#14261F",
    leaf: "#3D7A5A",
    "leaf-bright": "#4F9A6E",
    mist: "#C9D7CF",
    paper: "#F3EFE6",
    cream: "#F8F6F0",
    card: "#FFFCF7",
    ink: "#1C2A22",
    muted: "#5C6B62",
    line: "#E6E0D4",
    gold: "#A68B4B",
    amber: "#F8E6B8",
    "amber-ink": "#6A4B00",
    danger: "#8B2E2E",
    white: "#ffffff",
  },

  demo: {
    enabled: true,
    banner:
      "DEMO — Fictional business for a student portfolio. Not a real company, and no lawn care is being offered.",
  },

  hero: {
    kicker: "Holland, Michigan",
    headline: "A lawn you can be proud of, without the weekend work.",
    lede:
      "Weekly mowing, seasonal cleanup, and lawn health for homes around Holland. Tell us what you need and we’ll follow up the same day.",
    cta: "Get a free quote",
    secondaryCta: "See our services",
    points: [
      "Same-day follow-up on every quote request",
      "Careful work around gardens, kids, and pets",
      "Clear pricing before we start",
    ],
  },

  servicesIntro: {
    kicker: "What we do",
    heading: "Straightforward lawn care, done on a schedule you can count on.",
    lede:
      "Start with weekly mowing, or ask about a one-time cleanup or a plan to get a tired lawn healthy again.",
  },

  services: [
    {
      icon: "mower",
      title: "Weekly mowing",
      text: "A simple, reliable mow for homes in the Holland area, with edges and a tidy finish.",
    },
    {
      icon: "leaf",
      title: "Seasonal cleanup",
      text: "Spring raking, fall leaves, and a bed refresh before winter so the yard is ready for the next season.",
    },
    {
      icon: "bed",
      title: "Mulching and garden beds",
      text: "Fresh mulch and clean edges that keep beds looking cared for and help hold moisture.",
    },
    {
      icon: "drop",
      title: "Fertilization and weed control",
      text: "A practical plan to thicken the lawn and keep weeds from taking over, timed for West Michigan weather.",
    },
    {
      icon: "seed",
      title: "Aeration and overseeding",
      text: "Open up compacted soil and fill in thin spots so grass can root more deeply.",
    },
    {
      icon: "sod",
      title: "New lawn or sod",
      text: "Repair a bare patch or start a new lawn the right way, with advice on watering and first cuts.",
    },
  ],

  /* Used in the quote form dropdown. Keep "Other" last. */
  serviceOptions: [
    "Lawn mowing",
    "Spring or fall cleanup",
    "Mulching and garden beds",
    "Fertilization and weed control",
    "Aeration and overseeding",
    "New lawn or sod",
    "Other",
  ],

  whyIntro: {
    kicker: "Why us",
    heading: "Local, careful, and easy to reach.",
    lede: "The goal is a yard that looks cared for, and a process that does not create more work for you.",
  },

  whyUs: [
    {
      title: "Same-day follow-up",
      text: "Every web inquiry gets a prompt reply, not a lead that sits in a junk folder. You’ll hear back later that day.",
    },
    {
      title: "Local routes, reliable timing",
      text: "We plan work around Holland, Zeeland, and nearby townships so weekly visits stay consistent.",
    },
    {
      title: "Careful around what matters",
      text: "Gardens, kids’ toys, and pets are part of the job, not an afterthought. We treat your yard like a home.",
    },
    {
      title: "Clear pricing before we start",
      text: "Quotes are free, with no pressure. You’ll know what’s included and what it costs before any work begins.",
    },
  ],

  serviceArea: {
    kicker: "Service area",
    heading: "Holland, Michigan, and nearby communities.",
    lede:
      "If you are in or around Holland, we can usually help. If you are just outside this list, still send a note — we’ll tell you honestly whether we can get there.",
    towns: [
      "Holland",
      "Park Township",
      "Laketown Township",
      "Zeeland",
      "Hudsonville",
      "Fillmore Township",
      "Saugatuck",
      "Douglas",
    ],
  },

  testimonialsIntro: {
    kicker: "Testimonials",
    heading: "What neighbors might say.",
    lede:
      "These are sample testimonials for this fictional demo, so you can see how reviews would look on a real client site. They are not from real customers.",
  },

  testimonials: [
    {
      quote:
        "They started mid-season and the yard looked even by the second visit. Scheduling was easy, and I always knew what day they were coming.",
      name: "M. V.",
      place: "Holland",
    },
    {
      quote:
        "Fall cleanup was thorough, and they were careful around the flower beds. The curb looked ready for winter without me spending a weekend on it.",
      name: "J. P.",
      place: "Zeeland",
    },
    {
      quote:
        "I requested a quote in the morning and heard back the same day. That alone made it easy to say yes.",
      name: "S. K.",
      place: "Park Township",
    },
  ],

  /* Short label shown on every testimonial card so samples are never mistaken for real reviews. */
  testimonialBadge: "Sample testimonial",

  faqIntro: {
    kicker: "FAQ",
    heading: "Common questions before you request a quote.",
  },

  faqs: [
    {
      q: "Is Tulip City Lawn Care a real company?",
      a: "No. This is a fictional business built as a student portfolio demo in Holland, Michigan. It shows what a small lawn-care website and quote form can look like. No lawn care is being offered.",
    },
    {
      q: "How do I get a quote?",
      a: "Fill out the free quote form on this page with your name, email, and the service you need. Phone is optional. On a live site, you would get a confirmation right away and a follow-up later that day.",
    },
    {
      q: "What does weekly mowing include?",
      a: "A regular mow, trimmed edges, and a tidy finish. If you want clippings bagged, extra bed weeding, or a different schedule, mention it in your message and we’ll include that in the quote.",
    },
    {
      q: "Which areas do you serve?",
      a: "Holland and nearby communities, including Park Township, Laketown Township, Zeeland, Hudsonville, Fillmore Township, Saugatuck, and Douglas. If you are close to that area, still ask.",
    },
    {
      q: "Do I need to be home?",
      a: "Usually not. As long as the gate is unlocked and we know about dogs or any spots to avoid, we can take care of the visit and leave the yard ready for you.",
    },
    {
      q: "How soon can you start?",
      a: "It depends on the season and the service. Tell us your timing in the form and we’ll follow up the same day with what’s realistic.",
    },
  ],

  form: {
    kicker: "Free quote",
    heading: "Get a free quote",
    lede:
      "Tell us a little about your yard. Required fields are marked. Phone is optional. We’ll follow up later today.",
    submitLabel: "Send my request",
    messagePlaceholder: "Yard size, timing, or anything we should know",
    thanksTitle: "Thanks, {firstName}.",
    thanksBody:
      "We have your request for {service} and will follow up later today.",
    thanksDemoNote:
      "This website demo does not send your request anywhere yet. When a form endpoint is connected, this is when a confirmation would go out and the inquiry would be saved for a follow-up.",
    thanksLiveNote:
      "If your email is handy, watch for a confirmation. We’ll follow up later today.",
    error:
      "Something went wrong while sending your request. Please try again, or email or call using the placeholder contact info on this page.",
    anotherLabel: "Send another request",
  },

  footer: {
    blurb:
      "is a fictional business in Holland, Michigan, built to demonstrate a client website with web-inquiry lead capture.",
    credit: "A student portfolio demo. Not a real company.",
  },
};
