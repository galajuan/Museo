/* =========================================================
   "The Docent" — MuseoDavao's chat guide.
   A lightweight, rule-based assistant, scoped to answer ONLY
   questions about MuseoDavao and this website. No external AI
   API, no server — runs entirely client-side, same as before.

   UI / DOM contract is UNCHANGED — layout.js still builds the
   panel (#docent-panel, #docentBody, #docentInput, etc.) and
   calls md_initDocent()/md_openDocent()/md_closeDocent()/
   md_toggleDocent(). Only the "brain" (md_answer) changed.

   SCOPE RULES (see project instructions):
   1. Only answers Museo/MuseoDavao-website questions.
   2. Uses real info drawn from this project (museum pages,
      shop.js, auth.js, cart.js, account/admin pages) — nothing
      invented.
   3. Unknown-but-in-scope  -> "Sorry, I don't have that
      information about Museo."
   4. Out-of-scope           -> "Sorry, I can only help with
      Museo and its website."
   5. Mixed questions are split, answered per-part, in-scope
      parts answered, out-of-scope parts refused.
   6. Typos / Taglish / short questions are tolerated via light
      fuzzy matching + a small phrase dictionary.
   7. Follow-up questions ("what about Sunday?") reuse the last
      topic/museum via MD_CONTEXT.
   8. Never asks for/reveals passwords, OTPs, personal account
      data, or API keys/config.
   ========================================================= */

/* ---------------- Knowledge base (matches the actual pages) ---------------- */
/* Sources: museo-dabawenyo.html, dbone-collection.html, national-museum.html */
const MD_KB = {
  dabawenyo: {
    key: "dabawenyo",
    name: "Museo Dabawenyo",
    aliases: ["dabawenyo", "museo dabawenyo", "heritage", "wing 1", "wing i"],
    hours: "Tuesday to Sunday, 8:00 AM – 5:00 PM. Closed Mondays.",
    isOpenOnDay: (day) => day !== "monday",
    fee: "Free admission — a donation box is available to support the museum.",
    address: "Magsaysay Park, Davao City, inside the old Court of First Instance building.",
    about:
      "Museo Dabawenyo is Davao City's own heritage museum, housed in the old Court of First Instance building fronting Magsaysay Park. Its galleries move chronologically — from the Bagobo, Mandaya, Kalagan, and other indigenous communities, through Spanish and American colonial rule and the Japanese occupation, into modern Davao.",
    goodToKnow: [
      "Free admission, though a donation box supports upkeep.",
      "Closed on Mondays and select public holidays.",
      "Photography is generally allowed; flash is discouraged near textiles and documents.",
      "Guided walkthroughs can sometimes be arranged for groups — ask at the front desk.",
    ],
    duration: "It's compact — easy to cover in under an hour.",
  },
  dbone: {
    key: "dbone",
    name: "D'Bone Collector Museum",
    aliases: ["dbone", "d'bone", "d bone", "bone", "whale", "skeleton", "wing 2", "wing ii"],
    hours: "Daily, 10:00 AM – 5:00 PM (open every day, including holidays).",
    isOpenOnDay: () => true,
    fee: "₱250 for adults, ₱200 for students, and free for children 4 years old and below.",
    address: "Bolton Extension, Davao City.",
    about:
      "D'Bone Collector Museum was founded by wildlife rescuer Darrell Blatchley. It's a natural history museum built from cleaned, rearticulated marine skeletons — whale and dolphin specimens found stranded or beached along Davao's coastline. Entrance fees directly support ongoing marine rescue and preservation work.",
    goodToKnow: [
      "Entrance fees directly support ongoing rescue and preservation work.",
      "Some displays discuss animal mortality and plastic ingestion — be aware if visiting with young children.",
      "Allow 45–60 minutes for a full walkthrough.",
      "Open every day, including holidays.",
    ],
    duration: "Allow about 45–60 minutes for a full walkthrough.",
  },
  national: {
    key: "national",
    name: "National Museum of the Philippines – Davao",
    aliases: ["national", "national museum", "mindanao", "wing 3", "wing iii"],
    hours: "Tuesday to Sunday, 9:00 AM – 4:00 PM. Closed Mondays and national holidays.",
    isOpenOnDay: (day) => day !== "monday",
    fee: "Free admission, as with all National Museum branches nationwide.",
    address: "San Pedro Street, Davao City.",
    about:
      "This is the Davao branch of the National Museum of the Philippines. Its collection covers Mindanao's archaeology, ethnography (indigenous peoples' material culture), and natural history — a good companion to Museo Dabawenyo for the wider regional picture.",
    goodToKnow: [
      "Free admission, as with all National Museum branches nationwide.",
      "Closed Mondays and on national holidays — check ahead around long weekends.",
      "Bag checks are standard at the entrance.",
      "Some galleries rotate temporary exhibits — check the homepage's Current Exhibits section.",
    ],
    duration: null,
  },
};
const MD_MUSEUMS = Object.values(MD_KB);

/* Payment info — mirrors MD_PAYMENT_INFO in shop.js so the bot never drifts from checkout */
const MD_PAYMENTS = {
  gcash: "GCash — send to 09128461404 (MuseoDavao Shop), then enter your reference number at checkout.",
  bdo: "BDO — bank transfer to BDO Savings 0032-6027-0048 (MuseoDavao Shop Inc.), then enter your reference number at checkout.",
  bpi: "BPI — bank transfer to BPI Savings (MuseoDavao Shop Inc.); the account details are shown on the checkout page, then enter your reference number.",
  cash: "Cash — pay upon pickup (walk-in) or upon delivery (online order). No reference number needed.",
};

const MD_SUGGESTIONS = [
  "What are your opening hours?",
  "How much are the tickets?",
  "Tell me about D'Bone Collector Museum",
  "How do I order from the shop?",
  "How do I create an account?",
];

/* ---------------- Conversation memory (for follow-ups) ---------------- */
const MD_CONTEXT = { lastTopic: null, lastWhich: null };

/* ---------------- Fuzzy / typo helpers ---------------- */
function md_levenshtein(a, b) {
  if (a === b) return 0;
  const m = a.length, n = b.length;
  if (!m) return n;
  if (!n) return m;
  const dp = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j - 1], dp[i - 1][j], dp[i][j - 1]);
    }
  }
  return dp[m][n];
}

/* Common short words excluded from fuzzy matching so things like "what"/"time"
   don't accidentally "look like" a typo of a domain word (e.g. "whale"). Fuzzy
   matching only helps with genuine typos of the meaningful keyword itself. */
const MD_STOPWORDS = new Set([
  "a", "an", "the", "is", "are", "was", "were", "be", "been", "am",
  "i", "you", "he", "she", "it", "we", "they", "my", "your", "our",
  "what", "when", "where", "who", "why", "how", "which", "whose",
  "do", "does", "did", "can", "could", "would", "should", "will",
  "to", "of", "in", "on", "at", "for", "with", "and", "or", "but",
  "this", "that", "these", "those", "there", "here", "so", "if",
  "me", "us", "them", "him", "her", "about", "please", "just",
]);

/** True if any meaningful token in `text` equals or is a close typo of `word`. */
function md_fuzzyHas(text, word) {
  if (text.includes(word)) return true;
  // Only allow fuzzy (edit-distance) matching for longer words, and only
  // against reasonably long, non-stopword tokens — keeps short common
  // English words from accidentally matching unrelated domain terms.
  if (word.length < 4) return false;
  const maxDist = word.length <= 5 ? 1 : word.length <= 8 ? 2 : 3;
  const tokens = text.split(/[^a-z0-9']+/).filter((t) => t.length >= 4 && !MD_STOPWORDS.has(t));
  return tokens.some((t) => Math.abs(t.length - word.length) <= maxDist && md_levenshtein(t, word) <= maxDist);
}

function md_fuzzyAny(text, words) {
  return words.some((w) => md_fuzzyHas(text, w));
}

/* Small Taglish / shorthand normalizer — expands common local phrasing before matching */
const MD_TAGLISH_MAP = [
  [/\bmagkano\b/g, "how much price"],
  [/\bsaan\b|\bsan po\b/g, "where location"],
  [/\bkailan\b/g, "when schedule"],
  [/\bbukas\s*(ba)?\s*(kayo|po)?\b/g, "open hours"],
  [/\bsarado\b/g, "closed"],
  [/\bpwede\b|\bpwd\b/g, "can"],
  [/\bmag-?order\b|\bmagpa-?order\b/g, "order"],
  [/\bmag-?login\b/g, "login"],
  [/\bmag-?sign\s*up\b|\bmagparehistro\b/g, "register signup"],
  [/\bgaano katagal\b/g, "how long duration"],
  [/\blibre\b|\bwalang bayad\b/g, "free"],
  [/\bpila\b/g, "how much"],
  [/\boras\b/g, "hours time"],
  // A few very common English misspellings, spelled out explicitly rather
  // than relying solely on edit-distance (keeps fuzzy matching conservative
  // elsewhere, so it doesn't false-match unrelated short words).
  [/\bopne\b/g, "open"],
  [/\bhrs\b|\bhorz\b/g, "hours"],
  [/\btiket\b|\btikets\b/g, "ticket"],
  [/\baccnt\b|\bacount\b/g, "account"],
  [/\bpword\b|\bpasword\b|\bpasswrd\b/g, "password"],
  [/\breciept\b|\bresit\b/g, "receipt"],
];

function md_normalize(raw) {
  let q = (raw || "").toLowerCase().trim();
  MD_TAGLISH_MAP.forEach(([re, rep]) => (q = q.replace(re, rep)));
  return q;
}

/* ---------------- Scope vocabulary ---------------- */
const MD_SCOPE_WORDS = [
  "museo", "museodavao", "museum", "dabawenyo", "dbone", "bone", "national", "davao",
  "heritage", "skeleton", "whale", "dolphin", "mindanao", "wing", "exhibit", "event",
  "collection", "gallery", "tour", "docent", "guide",
  "hour", "hours", "open", "close", "closed", "time", "schedule",
  "ticket", "fee", "price", "entrance", "admission", "discount", "student", "senior", "child",
  "address", "location", "direction", "where",
  "shop", "order", "cart", "basket", "checkout", "buy", "souvenir", "merchandise", "product",
  "stock", "size", "delivery", "pickup", "walk-in",
  "pay", "payment", "gcash", "bdo", "bpi", "cash", "reference",
  "receipt", "print", "download",
  "account", "login", "log in", "logout", "register", "sign up", "signup", "password",
  "profile", "confirm", "email",
  "admin", "dashboard",
  "contact", "reach", "email us",
  "visit", "reserve", "reservation", "appointment", "book", "booking",
];

function md_inScope(q) {
  return md_fuzzyAny(q, MD_SCOPE_WORDS);
}

/* ---------------- Museum detection ---------------- */
function md_findMuseum(q) {
  return MD_MUSEUMS.find((kb) => md_fuzzyAny(q, kb.aliases) || md_fuzzyHas(q, kb.key));
}

/* ---------------- Day-of-week helpers (for follow-ups like "what about Sunday?") ---------------- */
const MD_DAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
function md_findDay(q) {
  return MD_DAYS.find((d) => q.includes(d));
}
function md_hoursForDay(kb, day) {
  const open = kb.isOpenOnDay(day);
  if (!open) return `${kb.name} is closed on ${day.charAt(0).toUpperCase() + day.slice(1)}s.`;
  return `Yes — ${kb.name} is open on ${day.charAt(0).toUpperCase() + day.slice(1)}s. ${kb.hours}`;
}

/* ---------------- Multi-museum list formatter ---------------- */
function md_listAll(field) {
  return MD_MUSEUMS.map((kb) => `• ${kb.name} — ${kb[field]}`).join("\n");
}

/* ---------------- Intent handlers ---------------- */
/* Each returns a string, or null if this intent doesn't apply to `q`. */
const MD_INTENTS = [
  {
    topic: "hours",
    test: (q) => md_fuzzyAny(q, ["hour", "hours", "open", "opening", "close", "closing", "closed", "schedule"]) && !md_fuzzyAny(q, ["shop", "order", "checkout"]),
    handle: (q, which) => {
      const day = md_findDay(q);
      if (day && which) return md_hoursForDay(which, day);
      if (day) return MD_MUSEUMS.map((kb) => md_hoursForDay(kb, day)).join("\n");
      if (which) return `${which.name} is open ${which.hours}`;
      return `Here are the hours for all three museums:\n${md_listAll("hours")}`;
    },
  },
  {
    topic: "hours-followup-day",
    test: (q) => Boolean(md_findDay(q)) && MD_CONTEXT.lastTopic === "hours",
    handle: (q, which) => {
      const day = md_findDay(q);
      const kb = which || MD_CONTEXT.lastWhich;
      if (kb) return md_hoursForDay(kb, day);
      return MD_MUSEUMS.map((m) => md_hoursForDay(m, day)).join("\n");
    },
  },
  {
    topic: "fee",
    test: (q) => md_fuzzyAny(q, ["ticket", "fee", "price", "entrance", "admission", "how much", "cost", "discount"]),
    handle: (q, which) => {
      if (which) return `${which.name}: ${which.fee}`;
      return `Ticket prices:\n${md_listAll("fee")}`;
    },
  },
  {
    topic: "address",
    test: (q) => md_fuzzyAny(q, ["where", "address", "location", "direction"]),
    handle: (q, which) => {
      if (which) return `${which.name} is located at ${which.address}`;
      return `Locations:\n${md_listAll("address")}`;
    },
  },
  {
    topic: "duration",
    test: (q) => md_fuzzyAny(q, ["how long", "duration", "minutes to visit", "how much time"]),
    handle: (q, which) => {
      if (which && which.duration) return `${which.name}: ${which.duration}`;
      if (which) return `We don't have an official visit-length estimate for ${which.name} listed, but you can take your time — there's no time limit.`;
      return "Rough visit lengths: Museo Dabawenyo is compact (under an hour); D'Bone Collector Museum runs about 45–60 minutes. No fixed duration is listed for the National Museum branch — take your time.";
    },
  },
  {
    topic: "reservation",
    test: (q) => md_fuzzyAny(q, ["reserve", "reservation", "appointment", "book", "booking", "slot"]) && !md_fuzzyAny(q, ["shop", "order", "product"]),
    handle: () =>
      "MuseoDavao doesn't use an online booking or reservation system for museum visits — you can simply walk in during opening hours. If you're bringing a large group and want a guided walkthrough at Museo Dabawenyo, you can ask about that in person at the front desk.",
  },
  {
    topic: "about",
    test: (q, which) => Boolean(which) && md_fuzzyAny(q, ["about", "tell me", "what is", "what's", "info", "information", "history"]),
    handle: (q, which) => which.about,
  },
  {
    topic: "goodtoknow",
    test: (q) => md_fuzzyAny(q, ["good to know", "tips", "before i go", "before visiting", "rules", "policy", "photography", "photo"]),
    handle: (q, which) => {
      if (which) return `Good to know about ${which.name}:\n` + which.goodToKnow.map((t) => `• ${t}`).join("\n");
      return "Ask me about a specific museum (Museo Dabawenyo, D'Bone Collector Museum, or the National Museum – Davao) and I can share visitor tips for that one.";
    },
  },
  {
    topic: "events",
    test: (q) => md_fuzzyAny(q, ["event", "exhibit", "happening", "exhibition", "current"]),
    handle: () =>
      "Current exhibits and events are listed on the homepage under \"Current Exhibits\" — that list is pulled live from our events calendar, so it's always up to date. Is there a particular museum's events you're after?",
  },
  {
    topic: "shop",
    test: (q) => md_fuzzyAny(q, ["order", "buy", "shop", "souvenir", "merchandise", "product", "cart", "basket"]) && !md_fuzzyAny(q, ["checkout", "payment", "pay", "receipt"]),
    handle: () =>
      "Ordering is easy: browse the Museum Shop, add items to your basket (some items need a size, like the National Museum's shirts), then go to checkout. Choose Pickup (walk-in) or Delivery, fill in your name, email, and phone (plus a delivery address if you chose Delivery), pick a payment method, and place your order. You'll land on a receipt page you can print or download.",
  },
  {
    topic: "checkout",
    test: (q) => md_fuzzyAny(q, ["checkout", "place order", "fulfillment", "delivery", "pickup", "walk-in"]),
    handle: () =>
      "At checkout you choose Pickup (walk-in) or Delivery (\"online\") — Delivery needs an address. Then enter your name, email, and phone, choose a payment method, and (unless paying cash) enter your payment reference number. Submitting the form creates your order and takes you straight to a receipt you can print or download.",
  },
  {
    topic: "payment",
    test: (q) => md_fuzzyAny(q, ["pay", "payment", "gcash", "bdo", "bpi", "cash", "reference number"]),
    handle: (q) => {
      const method = ["gcash", "bdo", "bpi", "cash"].find((m) => md_fuzzyHas(q, m));
      if (method) return MD_PAYMENTS[method];
      return (
        "We accept four payment methods at checkout:\n" +
        Object.values(MD_PAYMENTS).map((v) => `• ${v}`).join("\n")
      );
    },
  },
  {
    topic: "receipt",
    test: (q) => md_fuzzyAny(q, ["receipt", "proof of payment", "invoice"]),
    handle: () =>
      "Every order gets a receipt. Right after checkout you're taken straight to it, with buttons to print or download it. If you have an account, you can also revisit any receipt from \"My Orders\" in your Account page.",
  },
  {
    topic: "register",
    test: (q) => md_fuzzyAny(q, ["sign up", "signup", "register", "create account", "create an account"]),
    handle: () =>
      "To create an account: go to the Login page and click \"Create an account.\" Fill in your full name, email, an optional phone number, and a password (at least 8 characters, with an uppercase letter, a lowercase letter, a number, and a special character). After signing up, check your email for a confirmation link — clicking it takes you to the confirmation page and logs you in automatically.",
  },
  {
    topic: "login",
    test: (q) => md_fuzzyAny(q, ["log in", "login", "sign in", "signin"]) && !md_fuzzyAny(q, ["sign up", "signup", "register"]),
    handle: () =>
      "To log in, go to the Login page, enter your email and password, and submit. You'll be taken to your Account page (or the Admin dashboard if your account has staff/admin access).",
  },
  {
    topic: "password",
    test: (q) => md_fuzzyAny(q, ["password", "forgot password", "reset password"]),
    handle: (q) => {
      if (md_fuzzyAny(q, ["forgot", "reset", "recover", "lost"])) {
        return "This site doesn't currently have a self-service \"forgot password\" option. If you're locked out of your account, please reach the museum desk at hello@museodavao.ph. For your security, I can't ask for or handle your password here.";
      }
      return "For your security, I can't ask for, store, or reveal passwords. When creating an account, your password needs at least 8 characters, including an uppercase letter, a lowercase letter, a number, and a special character (e.g. ! @ # $ %).";
    },
  },
  {
    topic: "account",
    test: (q) => md_fuzzyAny(q, ["account", "my orders", "order history", "order status", "guest checkout", "logout", "log out"]),
    handle: (q) => {
      if (md_fuzzyAny(q, ["logout", "log out"])) return "You can log out anytime using the \"Log out\" button on your Account page.";
      return "You can check out as a guest without an account, but creating a free account lets you view your full order history and receipts under \"My Orders\" on your Account page. The Login/Account link is at the top-right of every page.";
    },
  },
  {
    topic: "admin",
    test: (q) => md_fuzzyAny(q, ["admin", "dashboard", "staff panel"]),
    handle: () =>
      "There's an Admin Dashboard (Products, Events, and Orders tabs) for MuseoDavao staff to manage the shop and site — it's only accessible to accounts with admin access. I can't help with admin login details or escalate account permissions here.",
  },
  {
    topic: "contact",
    test: (q) => md_fuzzyAny(q, ["contact", "email you", "reach you", "phone number", "get in touch"]),
    handle: () => "You can reach the MuseoDavao desk at hello@museodavao.ph, or use \"Ask the Docent\" (that's me!) in the site footer any time.",
  },
];

/* ---------------- Greeting / small talk (handled outside clause-splitting) ---------------- */
function md_greetingReply(q) {
  if (/^(hi|hello|hey|good\s?(morning|afternoon|evening)|kumusta|kamusta)\b/.test(q)) {
    return "Hello there! I'm the Docent — happy to help you plan your visit, check exhibits, or find something nice in the shop. What are you curious about?";
  }
  if (md_fuzzyAny(q, ["thank"]) || /\bsalamat\b/.test(q)) {
    return "You're very welcome — enjoy the visit, and don't be shy about coming back with more questions!";
  }
  if (md_fuzzyAny(q, ["who are you", "what are you"])) {
    return "I'm the Docent, MuseoDavao's resident chat guide — think of me as the front desk, minus the queue. Ask me about hours, tickets, exhibits, the shop, or your account.";
  }
  return null;
}

/* ---------------- Clause splitting for mixed questions ---------------- */
function md_splitClauses(q) {
  return q
    .split(/\?|\!|;|\n|(?:,\s*)|(?:\s+and\s+)|(?:\s+at saka\s+)|(?:\s+pati\s+)/i)
    .map((s) => s.trim())
    .filter(Boolean);
}

/* ---------------- Core answer engine ---------------- */
function md_answerClause(rawClause) {
  const q = md_normalize(rawClause);
  if (!q) return null;

  const which = md_findMuseum(q) || null;

  for (const intent of MD_INTENTS) {
    if (intent.test(q, which)) {
      const text = intent.handle(q, which);
      if (text) {
        MD_CONTEXT.lastTopic = intent.topic;
        MD_CONTEXT.lastWhich = which || MD_CONTEXT.lastWhich;
        return { inScope: true, text };
      }
    }
  }

  // A museum was named but no specific intent matched -> give its overview.
  if (which) {
    MD_CONTEXT.lastTopic = "about";
    MD_CONTEXT.lastWhich = which;
    return { inScope: true, text: which.about };
  }

  // Recognizably Museo-related but we don't have that specific info.
  if (md_inScope(q)) {
    return { inScope: true, text: "Sorry, I don't have that information about Museo." };
  }

  // Not Museo-related at all.
  return { inScope: false, text: null };
}

function md_answer(raw) {
  const wholeNormalized = md_normalize(raw);

  // Greetings/small talk take priority ONLY if that's the whole message.
  const greet = md_greetingReply(wholeNormalized.trim());
  if (greet && md_splitClauses(wholeNormalized).length <= 1) return greet;

  const clauses = md_splitClauses(raw);
  if (clauses.length === 0) return "Sorry, I didn't quite catch that — could you rephrase your question about Museo?";

  const answered = [];
  let hadUnrelated = false;
  let unrelatedExample = "";

  clauses.forEach((clause) => {
    // Skip pure greeting fragments inside a mixed message (e.g. "Hi, what time...")
    const cNorm = md_normalize(clause);
    if (/^(hi|hello|hey|good\s?(morning|afternoon|evening)|kumusta|kamusta)$/.test(cNorm.trim())) return;

    const result = md_answerClause(clause);
    if (!result) return;
    if (result.inScope) {
      if (!answered.includes(result.text)) answered.push(result.text);
    } else {
      hadUnrelated = true;
      if (!unrelatedExample) unrelatedExample = clause.trim();
    }
  });

  if (answered.length === 0 && hadUnrelated) {
    return "Sorry, I can only help with Museo and its website.";
  }
  if (answered.length === 0) {
    return "Sorry, I don't have that information about Museo.";
  }

  let reply = answered.join("\n\n");
  if (hadUnrelated) {
    reply += `\n\nI can only help with Museo and its website, so I can't answer${
      unrelatedExample ? ` "${unrelatedExample}"` : " the other part of that"
    }.`;
  }
  return reply;
}

/* ---------------- Chat UI plumbing (unchanged behavior) ---------------- */
function md_pushMessage(text, sender) {
  const body = document.getElementById("docentBody");
  const div = document.createElement("div");
  div.className = `msg ${sender}`;
  div.textContent = text;
  body.appendChild(div);
  body.scrollTop = body.scrollHeight;
}

function md_handleSend() {
  const input = document.getElementById("docentInput");
  const text = input.value.trim();
  if (!text) return;
  md_pushMessage(text, "user");
  input.value = "";
  setTimeout(() => {
    md_pushMessage(md_answer(text), "bot");
  }, 380);
}

function md_initDocent() {
  const suggestWrap = document.getElementById("docentSuggest");
  suggestWrap.innerHTML = MD_SUGGESTIONS.map((s) => `<button class="chip" data-q="${s}">${s}</button>`).join("");
  suggestWrap.querySelectorAll(".chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      md_pushMessage(chip.dataset.q, "user");
      setTimeout(() => md_pushMessage(md_answer(chip.dataset.q), "bot"), 350);
    });
  });

  md_pushMessage(
    "Hi, I'm the Docent 🏺 — ask me about hours, tickets, exhibits, or how ordering from the shop works.",
    "bot"
  );

  document.getElementById("docentSendBtn").addEventListener("click", md_handleSend);
  document.getElementById("docentInput").addEventListener("keydown", (e) => {
    if (e.key === "Enter") md_handleSend();
  });
}

function md_openDocent() {
  document.getElementById("docent-panel")?.classList.add("open");
  document.getElementById("overlay")?.classList.add("open");
}
function md_closeDocent() {
  document.getElementById("docent-panel")?.classList.remove("open");
  document.getElementById("overlay")?.classList.remove("open");
}
function md_toggleDocent() {
  document.getElementById("docent-panel")?.classList.contains("open") ? md_closeDocent() : md_openDocent();
}
