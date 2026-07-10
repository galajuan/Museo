/* =========================================================
   "The Docent" — MuseoDavao's chat guide.
   A lightweight, humanized rule-based assistant that answers
   anything related to the 3 museums, events, tickets, and shop.
   No external AI API required — runs entirely client-side.

   Want it smarter? Swap md_answer() to call the Anthropic API
   from an artifact/back-end of your choosing — the function
   signature (question -> string) stays the same.
   ========================================================= */

const MD_KB = {
  dabawenyo: {
    name: "Museo Dabawenyo",
    hours: "Tuesday to Sunday, 8:00 AM – 5:00 PM. Closed Mondays.",
    fee: "Free admission — a small donation box is available at the entrance.",
    address: "Magsaysay Park, Davao City, right by the waterfront.",
    about:
      "Museo Dabawenyo is the city's heritage museum, set inside the old Court of First Instance building. It walks you through Davao's story — from the Bagobo, Mandaya, and other indigenous communities, through Spanish and Japanese-era history, to the city we know today.",
  },
  dbone: {
    name: "D'Bone Collector Museum",
    hours: "Open daily, 9:00 AM – 6:00 PM.",
    fee: "₱60 for adults, ₱40 for students — kept low on purpose since it supports marine rescue work.",
    address: "Bolton Extension, Davao City.",
    about:
      "D'Bone is a one-of-a-kind natural history museum built from cleaned, rearticulated animal skeletons — whales, dolphins, and other marine life rescued (often too late) by founder Darrell Blatchley's team. It's equal parts museum and conservation message.",
  },
  national: {
    name: "National Museum of the Philippines – Davao",
    hours: "Tuesday to Sunday, 9:00 AM – 4:00 PM. Closed Mondays and holidays.",
    fee: "Free admission, as with all National Museum branches.",
    address: "San Pedro Street, Davao City.",
    about:
      "This is the Davao branch of the National Museum, focused on Mindanao's archaeology, ethnography, and natural history — a good stop if you want the wider regional picture beyond the city itself.",
  },
};

const MD_SUGGESTIONS = [
  "What are your operating hours?",
  "How much are the tickets?",
  "Tell me about D'Bone Collector Museum",
  "How do I order from the shop?",
  "What payment methods do you accept?",
];

function md_pushMessage(text, sender) {
  const body = document.getElementById("docentBody");
  const div = document.createElement("div");
  div.className = `msg ${sender}`;
  div.textContent = text;
  body.appendChild(div);
  body.scrollTop = body.scrollHeight;
}

function md_answer(raw) {
  const q = raw.toLowerCase();

  const mentionsMuseum = (kb) =>
    q.includes(kb.name.toLowerCase().split(" ")[0].toLowerCase()) ||
    (kb === MD_KB.dabawenyo && (q.includes("dabawenyo") || q.includes("heritage"))) ||
    (kb === MD_KB.dbone && (q.includes("dbone") || q.includes("d'bone") || q.includes("bone") || q.includes("whale") || q.includes("skeleton"))) ||
    (kb === MD_KB.national && (q.includes("national") || q.includes("mindanao")));

  const which = Object.values(MD_KB).find(mentionsMuseum);

  // Greetings — humanized opener
  if (/^(hi|hello|hey|good (morning|afternoon|evening))\b/.test(q.trim())) {
    return "Hello there! I'm the Docent — happy to help you plan your visit, check exhibits, or find something nice in the shop. What are you curious about?";
  }

  if (q.includes("thank")) {
    return "You're very welcome — enjoy the visit, and don't be shy about coming back with more questions!";
  }

  if (q.includes("hour") || q.includes("open") || q.includes("close") || q.includes("time")) {
    if (which) return `${which.name} is open ${which.hours}`;
    return `Here are the hours for all three museums:\n• Museo Dabawenyo — ${MD_KB.dabawenyo.hours}\n• D'Bone Collector Museum — ${MD_KB.dbone.hours}\n• National Museum – Davao — ${MD_KB.national.hours}`;
  }

  if (q.includes("ticket") || q.includes("fee") || q.includes("price") || q.includes("entrance") || q.includes("how much")) {
    if (which) return `${which.name}: ${which.fee}`;
    return `Ticket prices:\n• Museo Dabawenyo — ${MD_KB.dabawenyo.fee}\n• D'Bone Collector Museum — ${MD_KB.dbone.fee}\n• National Museum – Davao — ${MD_KB.national.fee}`;
  }

  if (q.includes("where") || q.includes("address") || q.includes("location") || q.includes("direction")) {
    if (which) return `${which.name} is located at ${which.address}`;
    return `Locations:\n• Museo Dabawenyo — ${MD_KB.dabawenyo.address}\n• D'Bone Collector Museum — ${MD_KB.dbone.address}\n• National Museum – Davao — ${MD_KB.national.address}`;
  }

  if (which && (q.includes("about") || q.includes("tell me") || q.includes("what is") || q.includes("what's"))) {
    return which.about;
  }
  if (which) return which.about;

  if (q.includes("event") || q.includes("exhibit") || q.includes("happening") || q.includes("schedule")) {
    return "Current exhibits and events are listed on the homepage under \"Current Exhibits\" — they're pulled live from our calendar, so that list is always up to date. Is there a particular museum's events you're after?";
  }

  if (q.includes("order") || q.includes("buy") || q.includes("shop") || q.includes("souvenir") || q.includes("checkout")) {
    return "Ordering is easy: browse the Museum Shop, add items to your basket, then choose either delivery (\"online\") or walk-in pickup (\"physical\") at checkout. You'll get a receipt you can download or print once payment is confirmed.";
  }

  if (q.includes("pay") || q.includes("gcash") || q.includes("bdo") || q.includes("bpi") || q.includes("cash")) {
    return "We accept GCash, BDO, BPI bank transfer, or cash on pickup/delivery. Pick your method at checkout — for GCash/BDO/BPI we'll show you the account details and you just add your reference number so we can match your payment.";
  }

  if (q.includes("receipt")) {
    return "Every order gets a receipt you can download as a PDF or print directly — you'll find both buttons on your order confirmation and in \"My Orders\" once you're logged in.";
  }

  if (q.includes("account") || q.includes("sign up") || q.includes("login") || q.includes("register")) {
    return "You can browse and even check out as a guest, but creating a free account lets you track your orders and reorder favorites. The Login link is at the top-right of every page.";
  }

  if (q.includes("who are you") || q.includes("what are you")) {
    return "I'm the Docent, MuseoDavao's resident guide. Think of me as the person at the front desk who's happy to answer the same question for the tenth time that day — hours, tickets, exhibits, shop orders, all of it.";
  }

  // Fallback — still warm, gives a path forward
  return "That's a good question — I don't have a ready answer for that one, but I don't want to guess and get it wrong. For anything specific about a visit or an order, our front desk can help at hello@museodavao.ph. In the meantime, want to know about hours, tickets, or the shop?";
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
