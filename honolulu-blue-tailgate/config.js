/* =============================================================================
   REBRAND THIS SITE HERE
   -----------------------------------------------------------------------------
   Change the business name, colors, phone number, packages, menu, and wording
   in this file only. You do not need to edit the other files for a typical
   client, or later for your own service site.

   FORM_ENDPOINT: leave this as an empty string while you are testing. The
   form will show a friendly thank-you message and will not send anything.
   Later, paste a Google Form or Apps Script web app URL here to collect
   real reservations. See the comments on FORM_ENDPOINT below.
   ============================================================================= */

const SITE = {
  name: "Honolulu Blue Tailgate Co.",
  city: "Detroit, MI",
  tagline: "Watch-party tables and tailgate catering in Detroit",

  /* Placeholder contact info only — not a real business */
  phone: "(313) 555-0172",
  phoneHref: "tel:+13135550172",
  email: "hello@example.com",
  locationNote: "Detroit, MI",

  /*
    Leave "" for now. The form will thank the visitor and stay on this page.
    When you are ready to collect real reservations, paste one of these:
      - An Apps Script web app URL, such as
        https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec
      - A Google Form formResponse URL, such as
        https://docs.google.com/forms/d/e/YOUR_FORM_ID/formResponse
    If you use a Google Form, also change FORM_FIELD_MAP values to the
    matching entry IDs (for example, "entry.123456789").
  */
  FORM_ENDPOINT: "",

  FORM_FIELD_MAP: {
    name: "name",
    email: "email",
    phone: "phone",
    service: "service",
    partySize: "partySize",
    date: "date",
    message: "message",
  },

  /* Honolulu blue and silver palette. These become CSS variables automatically. */
  colors: {
    navy: "#071824",
    "navy-deep": "#041018",
    honolulu: "#0076B6",
    "honolulu-deep": "#0A3D5C",
    "honolulu-mid": "#005A8C",
    "honolulu-bright": "#2B9BD8",
    silver: "#C5CBD1",
    "silver-deep": "#8B929A",
    mist: "#D7DEE4",
    paper: "#F3F5F7",
    cream: "#E8EEF2",
    card: "#FFFFFF",
    ink: "#15202A",
    muted: "#4E5A64",
    line: "#D2D8DE",
    gold: "#C4A46A",
    amber: "#F3E6C8",
    "amber-ink": "#6A4F16",
    danger: "#8B2E2E",
    white: "#ffffff",
  },

  demo: {
    enabled: true,
    banner:
      "DEMO — Fictional business for a student portfolio. Unofficial fan project, not affiliated with the NFL or the Detroit Lions. No tables or catering are being offered.",
  },

  hero: {
    kicker: "Detroit, MI",
    headline: "Game day in Detroit, with the table already saved.",
    lede:
      "Watch-party tables, tailgate catering trays, and a private room for friends who follow Detroit football. Tell us what you need and we’ll hold the spot.",
    cta: "Reserve a table",
    secondaryCta: "See packages",
    points: [
      "Reserved tables for a big-screen watch party",
      "Catering trays for a tailgate or a table in-house",
      "A private room for birthdays and office groups",
    ],
  },

  /*
    Clearly marked SAMPLE date for the "Next game day" countdown.
    This is not a real game schedule. Change the ISO string to try another date.
    Use an offset of -05:00 for Eastern Standard Time or -04:00 for Eastern Daylight Time.
  */
  nextGameDay: {
    iso: "2026-12-06T13:00:00-05:00",
    displayDate: "Sunday, December 6, 2026",
    displayTime: "1:00 p.m. Eastern (sample kickoff time)",
    badge: "Sample date",
    kicker: "Next game day",
    note:
      "This countdown uses a sample date for the demo. It is not a real game schedule.",
    pastMessage:
      "This sample game day has passed. On a live site, the next date would appear here.",
  },

  packagesIntro: {
    kicker: "Packages",
    heading: "Pick a table, a tray, or a room.",
    lede:
      "Three simple options, with sample prices marked as examples only. Nothing here is for sale — this is a portfolio demo.",
  },

  packages: [
    {
      icon: "table",
      title: "Watch-party tables",
      text:
        "A reserved table for four to eight, a shared screen, and trays that keep coming through the afternoon. Built for a Detroit football Sunday with friends.",
      priceLabel: "Sample price",
      price: "$28 per guest",
      priceNote: "Example only.",
    },
    {
      icon: "trays",
      title: "Tailgate catering trays",
      text:
        "Drop-off trays for a parking-lot tailgate or a backyard watch party: wings, sliders, sides, and a dessert, packed to travel.",
      priceLabel: "Sample price",
      price: "$90–$150 per tray",
      priceNote: "Example only.",
    },
    {
      icon: "room",
      title: "Private party room",
      text:
        "A closed room for birthdays, office watch parties, or a family get-together, with your own menu and a dedicated host.",
      priceLabel: "Sample price",
      price: "$425 for up to 20 guests",
      priceNote: "Example only.",
    },
  ],

  /* Used in the reservation form dropdown. Keep "Other" last. */
  packageOptions: [
    "Watch-party table",
    "Tailgate catering trays",
    "Private party room",
    "Other",
  ],

  menuIntro: {
    kicker: "Sample menu",
    heading: "Trays and plates for a long afternoon.",
    lede:
      "This is a sample menu with example prices, so you can see how a game-day bill of fare would look. None of these items are being sold.",
  },

  menuSections: [
    {
      title: "Shareable trays",
      items: [
        {
          name: "Gridiron wings",
          text: "Dry-rub or honey-garlic, with celery and ranch.",
          price: "$42",
        },
        {
          name: "Motor City pretzel bites",
          text: "Warm pretzels with a cheddar-ale dip.",
          price: "$18",
        },
        {
          name: "Tailgate nacho tray",
          text: "Smoked chicken, pickled jalapeños, and lime crema.",
          price: "$38",
        },
        {
          name: "Coney dog board",
          text: "Detroit-style coney chili, mustard, and onions.",
          price: "$36",
        },
      ],
    },
    {
      title: "Handhelds",
      items: [
        {
          name: "Smoked turkey sliders",
          text: "Pickle, sharp cheddar, and a soft roll.",
          price: "$16",
        },
        {
          name: "Italian sausage hoagie",
          text: "Peppers, onions, and a toasted hoagie.",
          price: "$15",
        },
        {
          name: "Detroit-style square slices",
          text: "Crisp cheese edge, two slices to a plate.",
          price: "$14",
        },
      ],
    },
    {
      title: "Sides",
      items: [
        {
          name: "Charred street-corn cups",
          text: "Cotija, chili, and lime.",
          price: "$9",
        },
        {
          name: "Vinegar slaw",
          text: "Crisp, bright, and made to cut the rich trays.",
          price: "$7",
        },
        {
          name: "Kettle chips and onion dip",
          text: "A bowl for the table.",
          price: "$6",
        },
      ],
    },
    {
      title: "Sweets and drinks",
      items: [
        {
          name: "Blueberry buckle",
          text: "A warm square with a crumb top.",
          price: "$8",
        },
        {
          name: "House lemonade",
          text: "Fresh, tart, and served over ice.",
          price: "$4",
        },
        {
          name: "Hot cider or cold brew",
          text: "Your call, depending on the weather.",
          price: "$4",
        },
      ],
    },
  ],

  galleryIntro: {
    kicker: "Gallery",
    heading: "Original drawings, not official art.",
    lede:
      "Every picture on this page is an original SVG illustration: a skyline, a grill, a football, and a watch-party table. There are no team logos, wordmarks, or player photos.",
  },

  gallery: [
    {
      id: "skyline",
      title: "Detroit skyline",
      caption: "A riverfront skyline study in Honolulu blue and silver.",
    },
    {
      id: "grill",
      title: "The grill",
      caption: "A kettle grill, drawn for this demo.",
    },
    {
      id: "football",
      title: "A plain football",
      caption: "A football with laces — no team marks.",
    },
    {
      id: "watchparty",
      title: "Watch-party table",
      caption: "String lights, shared trays, and a reserved table.",
    },
    {
      id: "trays",
      title: "Catering trays",
      caption: "Packed trays ready for a tailgate.",
    },
    {
      id: "pennant",
      title: "Game-day pennant",
      caption: "A handmade pennant that reads “Game day.”",
    },
  ],

  testimonialsIntro: {
    kicker: "Testimonials",
    heading: "What a table might say.",
    lede:
      "These are sample testimonials for this fictional demo, so you can see how reviews would look on a real client site. They are not from real customers.",
  },

  testimonials: [
    {
      quote:
        "We booked a table for six and it felt like a living room with a better screen. The wings tray was gone before the second half.",
      name: "A. R.",
      place: "Detroit",
    },
    {
      quote:
        "Ordered catering trays for a backyard watch party. Everything showed up labeled and hot, and nobody had to cook.",
      name: "J. L.",
      place: "Detroit",
    },
    {
      quote:
        "The private room made a birthday feel easy. We had a dedicated host and enough space for the whole group.",
      name: "K. M.",
      place: "Detroit",
    },
  ],

  /* Short label shown on every testimonial card so samples are never mistaken for real reviews. */
  testimonialBadge: "Sample testimonial",

  faqIntro: {
    kicker: "FAQ",
    heading: "Questions before you send a reservation request.",
  },

  faqs: [
    {
      q: "Is Honolulu Blue Tailgate Co. a real company?",
      a: "No. This is a fictional business built as a student portfolio demo in Holland, Michigan. It shows what a game-day watch-party and catering website could look like. No tables, rooms, or food are being offered.",
    },
    {
      q: "Is this affiliated with the NFL or the Detroit Lions?",
      a: "No. This is an unofficial fan project. It is not affiliated with, endorsed by, or associated with the National Football League or the Detroit Lions. The site uses plain-text mentions of Detroit football and original drawings only — no official logos, wordmarks, or player photos.",
    },
    {
      q: "Are the prices real?",
      a: "No. Every price on this site is a clearly marked example, so you can see how packages and a menu would be presented. They are not actual rates.",
    },
    {
      q: "Is the “next game day” countdown a real schedule?",
      a: "No. The countdown uses a sample date that is labeled as a sample. It is not taken from a real game schedule.",
    },
    {
      q: "How do reservations work on this demo?",
      a: "Fill out the form with your name, email, and a package. On this demo, you will see a thank-you message and nothing is sent. On a live site, the request would be saved and you would get a follow-up.",
    },
    {
      q: "Where are you located?",
      a: "The placeholder location for this fictional business is Detroit, MI. There is no real street address and no real dining room to visit.",
    },
  ],

  form: {
    kicker: "Reservations",
    heading: "Reserve a table",
    lede:
      "Tell us a little about your group. Required fields are marked. Phone is optional. On a live site, we would follow up the same day.",
    submitLabel: "Send my request",
    messagePlaceholder: "Occasion, timing, or anything we should know",
    dateLabel: "Preferred date",
    partyLabel: "Party size",
    thanksTitle: "Thanks, {firstName}.",
    thanksBody:
      "We have your reservation request for {service} and will follow up shortly.",
    thanksDemoNote:
      "This website demo does not send your request anywhere yet. When a form endpoint is connected, this is when a confirmation would go out and the request would be saved for a follow-up.",
    thanksLiveNote:
      "If your email is handy, watch for a confirmation. We’ll follow up shortly.",
    error:
      "Something went wrong while sending your request. Please try again, or email or call using the placeholder contact info on this page.",
    anotherLabel: "Send another request",
  },

  footer: {
    blurb:
      "is a fictional business and an unofficial fan project. It is not affiliated with, endorsed by, or associated with the National Football League or the Detroit Lions.",
    credit: "A student portfolio demo from Holland, Michigan. Not a real company.",
  },
};
