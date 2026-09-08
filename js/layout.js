/* =========================================================
   Shared layout: header, footer, cart drawer shell, docent shell.
   Each page sets `window.MD_PAGE = "home" | "dabawenyo" | "dbone" | "national" | "shop" | "login" | "admin"`
   BEFORE this script runs.
   ========================================================= */

const MD_NAV = [
  { key: "home", label: "Home", href: "index.html" },
  { key: "dabawenyo", label: "Museo Dabawenyo", href: "museo-dabawenyo.html" },
  { key: "dbone", label: "D'Bone Collection", href: "dbone-collection.html" },
  { key: "national", label: "National Museum", href: "national-museum.html" },
  { key: "shop", label: "Shop", href: "shop.html" },
];

function md_renderHeader() {
  const page = window.MD_PAGE || "";
  const links = MD_NAV.map(
    (n) =>
      `<a href="${n.href}" class="${n.key === page ? "active" : ""}">${n.label}</a>`
  ).join("");

  const header = document.createElement("header");
  header.className = "site-header";
  header.innerHTML = `
    <div class="nav-wrap">
      <a href="index.html" class="brand"><span class="mark"><span>M</span></span> MuseoDavao</a>
      <nav class="nav-links" id="navLinks">
        ${links}
        <a href="account.html" id="navAccountLink">Account</a>
      </nav>
      <div style="display:flex;align-items:center;gap:12px;">
        <button id="cartLauncherHeader" class="cart-pill" aria-label="Open cart">🧺 <span id="cartCountHeader">0</span></button>
        <button class="nav-toggle" id="navToggle" aria-label="Toggle menu">☰</button>
      </div>
    </div>`;
  document.body.prepend(header);

  document.getElementById("navToggle").addEventListener("click", () => {
    document.getElementById("navLinks").classList.toggle("open");
  });
  document.getElementById("cartLauncherHeader").addEventListener("click", md_toggleCart);
}

function md_renderFooter() {
  const footer = document.createElement("footer");
  footer.className = "site-footer";
  footer.innerHTML = `
    <div class="container footer-grid">
      <div>
        <h5>MuseoDavao</h5>
        <p style="max-width:280px;font-size:.9rem;opacity:.8;">
          One portal to Davao City's three museums — Museo Dabawenyo, the D'Bone Collector Museum,
          and the National Museum of the Philippines–Davao. Plan your visit, follow current exhibits,
          and bring a piece of the collection home.
        </p>
      </div>
      <div>
        <h5>Wings</h5>
        <a href="museo-dabawenyo.html">Museo Dabawenyo</a>
        <a href="dbone-collection.html">D'Bone Collection</a>
        <a href="national-museum.html">National Museum</a>
      </div>
      <div>
        <h5>Visit</h5>
        <a href="index.html#events">Current Exhibits</a>
        <a href="shop.html">Museum Shop</a>
        <a href="account.html">My Orders</a>
      </div>
      <div>
        <h5>Museum Desk</h5>
        <a href="#" id="footerChatLink">Ask Museo</a>
        <a href="mailto:hello@museodavao.ph">hello@museodavao.ph</a>
      </div>
    </div>
    <div class="container footer-bottom">
      <span>© ${new Date().getFullYear()} MuseoDavao — Davao City, Philippines</span>
      <span>Built with Supabase</span>
    </div>`;
  document.body.appendChild(footer);
  document.getElementById("footerChatLink").addEventListener("click", (e) => {
    e.preventDefault();
    md_openDocent();
  });
}

function md_renderCartShell() {
  const overlay = document.createElement("div");
  overlay.id = "overlay";
  overlay.addEventListener("click", () => {
    md_closeCart();
    md_closeDocent();
  });
  document.body.appendChild(overlay);

  const drawer = document.createElement("aside");
  drawer.id = "cart-drawer";
  drawer.innerHTML = `
    <div class="cart-head">
      <h3 style="margin:0;font-size:1.1rem;">Your Basket</h3>
      <button id="closeCartBtn" style="background:none;border:none;color:var(--paper);font-size:1.3rem;">×</button>
    </div>
    <div class="cart-items" id="cartItemsWrap"></div>
    <div class="cart-foot">
      <div class="cart-total-row"><span>Subtotal</span><span id="cartSubtotal">₱0.00</span></div>
      <a href="shop.html#checkout" class="btn btn-dark" style="width:100%;justify-content:center;">Go to checkout</a>
    </div>`;
  document.body.appendChild(drawer);
  document.getElementById("closeCartBtn").addEventListener("click", md_closeCart);
}

function md_renderDocentShell() {
  const launcher = document.createElement("button");
  launcher.id = "docent-launcher";
  launcher.innerHTML = "💬";
  launcher.setAttribute("aria-label", "Chat with Museo");
  document.body.appendChild(launcher);
  launcher.addEventListener("click", md_toggleDocent);

  const panel = document.createElement("div");
  panel.id = "docent-panel";
  panel.innerHTML = `
    <div class="docent-head">
      <div class="who">
        <div class="avatar">M</div>
        <div>
          <h6>Museo</h6>
          <div class="status">Online · MuseoDavao guide</div>
        </div>
      </div>
      <button id="closeDocentBtn">×</button>
    </div>
    <div class="docent-body" id="docentBody"></div>
    <div class="docent-suggest" id="docentSuggest"></div>
    <div class="docent-input">
      <input id="docentInput" type="text" placeholder="Ask about hours, tickets, exhibits..." />
      <button id="docentSendBtn">Send</button>
    </div>`;
  document.body.appendChild(panel);
  document.getElementById("closeDocentBtn").addEventListener("click", md_closeDocent);
}

/* ---------- Product image zoom (lightbox) ---------- */
function md_escapeHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function md_zoomableImg(url, caption, extraAttrs) {
  if (!url) return "";
  return `<img src="${md_escapeHtml(url)}" alt="${md_escapeHtml(caption)}" class="zoomable" data-zoom-url="${md_escapeHtml(url)}" data-zoom-caption="${md_escapeHtml(caption)}" ${extraAttrs || ""}>`;
}

function md_renderZoomShell() {
  const overlay = document.createElement("div");
  overlay.id = "md-zoom-overlay";
  overlay.className = "md-zoom-overlay";
  overlay.innerHTML = `
    <button class="md-zoom-close" id="mdZoomClose" aria-label="Close zoomed image">×</button>
    <div class="md-zoom-inner">
      <img id="mdZoomImg" src="" alt="">
      <div class="md-zoom-caption" id="mdZoomCaption"></div>
    </div>`;
  document.body.appendChild(overlay);
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) md_closeZoom();
  });
  document.getElementById("mdZoomClose").addEventListener("click", md_closeZoom);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") md_closeZoom();
  });
  // Delegated click handler: works for any .zoomable image rendered anywhere,
  // now or in the future, regardless of special characters in names/URLs.
  document.addEventListener("click", (e) => {
    const img = e.target.closest("img.zoomable");
    if (img) md_openZoom(img.dataset.zoomUrl, img.dataset.zoomCaption);
  });
}

/** Open a full-size zoomed view of a product/collection image. Call from any page. */
function md_openZoom(url, caption) {
  if (!url) return;
  const overlay = document.getElementById("md-zoom-overlay");
  if (!overlay) return;
  document.getElementById("mdZoomImg").src = url;
  document.getElementById("mdZoomImg").alt = caption || "";
  document.getElementById("mdZoomCaption").textContent = caption || "";
  overlay.classList.add("open");
  document.body.style.overflow = "hidden";
}

function md_closeZoom() {
  const overlay = document.getElementById("md-zoom-overlay");
  if (!overlay) return;
  overlay.classList.remove("open");
  document.body.style.overflow = "";
}

/* ---------- Quantity stepper (product cards) ---------- */
function md_qtyFieldHtml(qtyId, maxStock, unitPrice) {
  const max = Math.max(1, Number(maxStock) || 1);
  const price = Number(unitPrice) || 0;
  return `<div class="qty-field">
    <label for="${qtyId}">Quantity</label>
    <div class="qty-ctl">
      <button type="button" onclick="md_stepQty('${qtyId}',-1)">−</button>
      <input type="number" id="${qtyId}" value="1" min="1" max="${max}" data-unit-price="${price}" inputmode="numeric" oninput="md_updateQtySubtotal('${qtyId}')">
      <button type="button" onclick="md_stepQty('${qtyId}',1)">+</button>
    </div>
    <div class="qty-subtotal" id="subtotal-${qtyId}">Subtotal: ₱${price.toFixed(2)}</div>
  </div>`;
}

function md_updateQtySubtotal(qtyId) {
  const input = document.getElementById(qtyId);
  const sub = document.getElementById(`subtotal-${qtyId}`);
  if (!input || !sub) return;
  const max = parseInt(input.max, 10) || 1;
  let val = parseInt(input.value, 10) || 1;
  val = Math.min(max, Math.max(1, val));
  input.value = val;
  const unit = parseFloat(input.dataset.unitPrice) || 0;
  sub.textContent = `Subtotal: ₱${(unit * val).toFixed(2)}`;
}

function md_stepQty(qtyId, delta) {
  const input = document.getElementById(qtyId);
  if (!input) return;
  const max = parseInt(input.max, 10) || 1;
  let val = parseInt(input.value, 10) || 1;
  val = Math.min(max, Math.max(1, val + delta));
  input.value = val;
  md_updateQtySubtotal(qtyId);
}

async function md_updateAccountLink() {
  const link = document.getElementById("navAccountLink");
  if (!link || typeof md_getSession !== "function") return;
  try {
    const session = await md_getSession();
    if (session) {
      const profile = await md_getProfile();
      link.textContent = profile && profile.role === "admin" ? "Admin" : "Account";
      link.href = profile && profile.role === "admin" ? "admin.html" : "account.html";
    } else {
      link.textContent = "Login";
      link.href = "login.html";
    }
  } catch (e) {
    link.textContent = "Login";
    link.href = "login.html";
  }
}

function md_initLayout() {
  md_renderHeader();
  md_renderCartShell();
  md_renderDocentShell();
  md_renderZoomShell();
  md_renderFooter();
  md_updateAccountLink();
  if (typeof md_renderCart === "function") md_renderCart();
  if (typeof md_initDocent === "function") md_initDocent();
}

document.addEventListener("DOMContentLoaded", md_initLayout);
