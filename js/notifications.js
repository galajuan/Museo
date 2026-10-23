/* =========================================================
   Notifications — bell in the header
   ---------------------------------------------------------
   Shoppers/visitors get notified when:
     • a new product is added to the shop
     • a new event / exhibit is posted
     • the status of THEIR order changes (paid, preparing, ready…)
   Admins additionally get notified when:
     • a NEW account is created
     • a NEW purchase (order) is placed
     • a product's stock goes DOWN (with low / out-of-stock warnings)
   Customers are told when their order is accepted, declined, ready to
   claim, or out for delivery.

   Notifications are saved in localStorage (per account), so they
   survive page changes, and anything that happened while the visitor
   was away is caught up the next time they open the site.
   Requires: supabase-client.js, auth.js, cart.js (md_toast), layout.js
   ========================================================= */
const MD_NOTIF_MAX = 30;
const MD_LOW_STOCK_LEVEL = 5;
const MD_ORDER_STATUS_TITLE = {
  pending: "pending",
  accepted: "accepted",
  declined: "declined",
  paid: "paid",
  preparing: "being prepared",
  ready: "ready to claim",
  out_for_delivery: "out for delivery",
  completed: "completed",
  cancelled: "cancelled",
};
function md_orderStatusText(status, fulfillment) {
  const pickup = fulfillment !== "online";
  switch (status) {
    case "pending": return "is pending — we're waiting for confirmation.";
    case "accepted": return "was accepted by the shop. We'll start working on it!";
    case "declined": return "was declined by the admin. Please contact the museum shop for details.";
    case "paid": return "payment was confirmed. Thank you!";
    case "preparing": return "is now being prepared.";
    case "ready": return pickup ? "is ready to claim! Please pick it up at the museum shop." : "is packed and ready — it will be out for delivery soon.";
    case "out_for_delivery": return "is out for delivery. Please keep your phone nearby!";
    case "completed": return "has been completed. Enjoy your keepsake!";
    case "cancelled": return "was cancelled.";
    default: return "was updated.";
  }
}

let MD_NOTIF_UID = "guest";
let MD_NOTIF_IS_ADMIN = false;
let MD_NOTIF_STATE = { items: [], lastCheck: null, orderStatus: {} };

function md_notifKey() {
  return `museodavao_notifs_v1_${MD_NOTIF_UID}`;
}
function md_notifLoad() {
  try {
    const s = JSON.parse(localStorage.getItem(md_notifKey()));
    if (s && Array.isArray(s.items)) MD_NOTIF_STATE = { orderStatus: {}, lastCheck: null, ...s };
  } catch (e) {}
}
function md_notifSave() {
  try {
    localStorage.setItem(md_notifKey(), JSON.stringify(MD_NOTIF_STATE));
  } catch (e) {}
}

function md_notifDate(d) {
  const x = new Date(d + "T00:00:00");
  return isNaN(x) ? d : x.toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });
}

function md_timeAgo(ts) {
  const diff = Math.max(0, Date.now() - ts);
  const m = Math.floor(diff / 60000);
  if (m < 1) return "Just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return d < 7 ? `${d}d ago` : new Date(ts).toLocaleDateString("en-PH", { month: "short", day: "numeric" });
}

/** Adds a notification (ignored if the same id already exists). */
function md_pushNotif({ id, type, title, text, href, ts, silent }) {
  if (MD_NOTIF_STATE.items.some((n) => n.id === id)) return;
  MD_NOTIF_STATE.items.unshift({ id, type, title, text, href: href || "", ts: ts || Date.now(), read: false });
  MD_NOTIF_STATE.items.sort((a, b) => b.ts - a.ts);
  MD_NOTIF_STATE.items = MD_NOTIF_STATE.items.slice(0, MD_NOTIF_MAX);
  md_notifSave();
  md_renderNotifs();
  if (!silent && typeof md_toast === "function") md_toast(`🔔 ${title}`);
}

function md_renderNotifs() {
  const badge = document.getElementById("notifBadge");
  const list = document.getElementById("notifList");
  if (!badge || !list) return;
  const unread = MD_NOTIF_STATE.items.filter((n) => !n.read).length;
  badge.textContent = unread > 9 ? "9+" : unread;
  badge.style.display = unread ? "flex" : "none";

  const icons = { product: "🛍️", event: "🎟️", order: "📦", account: "👤", stock: "⚠️" };
  list.innerHTML = MD_NOTIF_STATE.items.length
    ? MD_NOTIF_STATE.items
        .map(
          (n) => `
      <a class="notif-item ${n.read ? "" : "unread"}" href="${md_escapeHtml(n.href || "#")}" data-id="${md_escapeHtml(n.id)}">
        <span class="notif-ico">${icons[n.type] || "🔔"}</span>
        <span class="notif-body">
          <strong>${md_escapeHtml(n.title)}</strong>
          <span>${md_escapeHtml(n.text)}</span>
          <em>${md_timeAgo(n.ts)}</em>
        </span>
      </a>`
        )
        .join("")
    : `<p class="notif-empty">You're all caught up. New products, events and order updates will show up here.</p>`;
}

function md_notifMarkAllRead() {
  MD_NOTIF_STATE.items.forEach((n) => (n.read = true));
  md_notifSave();
  md_renderNotifs();
}

function md_renderNotifShell() {
  const cartBtn = document.getElementById("cartLauncherHeader");
  const adminSlot = document.getElementById("adminNotifSlot"); // admin.html has no site header
  if ((!cartBtn && !adminSlot) || document.getElementById("notifWrap")) return;
  const wrap = document.createElement("div");
  wrap.id = "notifWrap";
  wrap.className = "notif-wrap";
  wrap.innerHTML = `
    <button id="notifBtn" class="cart-pill notif-btn" aria-label="Notifications" aria-expanded="false">
      🔔<span id="notifBadge" class="notif-badge" style="display:none;">0</span>
    </button>
    <div id="notifPanel" class="notif-panel" role="dialog" aria-label="Notifications">
      <div class="notif-head">
        <h6>Notifications</h6>
        <div>
          <button type="button" id="notifReadAll">Mark all read</button>
          <button type="button" id="notifClear">Clear</button>
        </div>
      </div>
      <div id="notifList" class="notif-list"></div>
    </div>`;
  if (adminSlot) {
    wrap.classList.add("admin-bell");
    adminSlot.appendChild(wrap);
  } else {
    cartBtn.parentElement.insertBefore(wrap, cartBtn);
  }

  const panel = wrap.querySelector("#notifPanel");
  wrap.querySelector("#notifBtn").addEventListener("click", (e) => {
    e.stopPropagation();
    const open = panel.classList.toggle("open");
    wrap.querySelector("#notifBtn").setAttribute("aria-expanded", open);
    if (open) md_renderNotifs();
  });
  wrap.querySelector("#notifReadAll").addEventListener("click", md_notifMarkAllRead);
  wrap.querySelector("#notifClear").addEventListener("click", () => {
    MD_NOTIF_STATE.items = [];
    md_notifSave();
    md_renderNotifs();
  });
  panel.addEventListener("click", (e) => {
    e.stopPropagation();
    const a = e.target.closest(".notif-item");
    if (!a) return;
    const n = MD_NOTIF_STATE.items.find((x) => x.id === a.dataset.id);
    if (n) {
      n.read = true;
      md_notifSave();
    }
    if (!n || !n.href) e.preventDefault();
  });
  document.addEventListener("click", () => panel.classList.remove("open"));
}

/* ---------- Notification builders ---------- */
function md_notifyProduct(p, silent) {
  if (!p || p.is_active === false || p.for_sale === false) return;
  md_pushNotif({
    id: `product:${p.id}`,
    type: "product",
    title: "New in the shop",
    text: `"${p.name}" just arrived${p.price != null ? ` — ₱${Number(p.price).toFixed(2)}` : ""}.`,
    href: "shop.html",
    ts: p.created_at ? new Date(p.created_at).getTime() : Date.now(),
    silent,
  });
}
function md_notifyEvent(ev, silent) {
  if (!ev) return;
  md_pushNotif({
    id: `event:${ev.id}`,
    type: "event",
    title: "New event posted",
    text: `${ev.title}${ev.event_date ? " · " + md_notifDate(ev.event_date) : ""}`,
    href: "index.html#events",
    ts: ev.created_at ? new Date(ev.created_at).getTime() : Date.now(),
    silent,
  });
}
function md_notifyOrderStatus(o, silent) {
  if (!o) return;
  const prev = MD_NOTIF_STATE.orderStatus[o.id];
  MD_NOTIF_STATE.orderStatus[o.id] = o.status;
  md_notifSave();
  if (prev === o.status) return;
  // Don't notify the customer about the status they just created the order with
  if (prev === undefined && o.status === "pending" && silent) return;
  md_pushNotif({
    id: `order:${o.id}:${o.status}`,
    type: "order",
    title: `Order ${o.order_no} — ${MD_ORDER_STATUS_TITLE[o.status] || o.status}`,
    text: `Your order ${md_orderStatusText(o.status, o.fulfillment)}`,
    href: `receipt.html?order_no=${encodeURIComponent(o.order_no)}`,
    silent,
  });
}
function md_notifyAdminNewOrder(o, silent) {
  if (!o) return;
  md_pushNotif({
    id: `adminorder:${o.id}`,
    type: "order",
    title: "New purchase received",
    text: `${o.order_no} from ${o.guest_name || "a customer"} — ₱${Number(o.total || 0).toFixed(2)}`,
    href: "admin.html",
    ts: o.created_at ? new Date(o.created_at).getTime() : Date.now(),
    silent,
  });
}

function md_notifyAdminNewAccount(a, silent) {
  if (!a) return;
  md_pushNotif({
    id: `adminaccount:${a.id}`,
    type: "account",
    title: "New account created",
    text: `${a.full_name || "Someone"}${a.email ? " (" + a.email + ")" : ""} just signed up.`,
    href: "admin.html",
    ts: a.created_at ? new Date(a.created_at).getTime() : Date.now(),
    silent,
  });
}

/* Stock watcher (admin): realtime UPDATE payloads don't carry the old row,
   so we remember each product's last known stock and compare. */
let MD_STOCK_SEEN = {};
function md_stockSnapshot(p) {
  return { name: p.name, total: Number(p.stock) || 0, sizes: { ...(p.size_stock || {}) } };
}
async function md_stockInit() {
  const { data } = await supabase.from("products").select("id, name, stock, size_stock");
  (data || []).forEach((p) => (MD_STOCK_SEEN[p.id] = md_stockSnapshot(p)));
}
function md_notifyStockChange(p) {
  if (!p) return;
  const prev = MD_STOCK_SEEN[p.id];
  const cur = md_stockSnapshot(p);
  MD_STOCK_SEEN[p.id] = cur;
  if (!prev || cur.total >= prev.total) return; // only react to stock going DOWN
  // Which size dropped (if the product is sold by size)?
  const sizes = Object.keys(cur.sizes).filter((k) => (Number(cur.sizes[k]) || 0) < (Number(prev.sizes[k]) || 0));
  const sizeTxt = sizes.length ? ` (Size ${sizes.join(", ")})` : "";
  let level = "";
  if (cur.total <= 0) level = " — OUT OF STOCK!";
  else if (cur.total <= MD_LOW_STOCK_LEVEL) level = " — running low!";
  md_pushNotif({
    id: `stock:${p.id}:${Date.now()}`,
    type: "stock",
    title: cur.total <= 0 ? "Product out of stock" : "Stock decreased",
    text: `"${cur.name}"${sizeTxt} stock went ${prev.total} → ${cur.total}${level}`,
    href: "admin.html",
  });
}

/* ---------- Catch up on what happened while the visitor was away ---------- */
async function md_notifCatchUp() {
  const since = MD_NOTIF_STATE.lastCheck;
  MD_NOTIF_STATE.lastCheck = new Date().toISOString();
  md_notifSave();

  if (since) {
    const [prod, ev] = await Promise.all([
      supabase.from("products").select("*").eq("is_active", true).gt("created_at", since).order("created_at", { ascending: false }).limit(10),
      supabase.from("events").select("*").gt("created_at", since).order("created_at", { ascending: false }).limit(10),
    ]);
    (prod.data || []).forEach((p) => md_notifyProduct(p, true));
    (ev.data || []).forEach((e) => md_notifyEvent(e, true)); // errors (e.g. no created_at column) are ignored
  }
  await md_notifPollOrders(true);

  if (MD_NOTIF_IS_ADMIN) {
    await md_stockInit();
    if (since) {
      const [ord, acc] = await Promise.all([
        supabase.from("orders").select("id, order_no, guest_name, total, created_at").gt("created_at", since).order("created_at", { ascending: false }).limit(10),
        supabase.from("profiles").select("id, full_name, email, created_at").gt("created_at", since).order("created_at", { ascending: false }).limit(10),
      ]);
      (ord.data || []).forEach((o) => md_notifyAdminNewOrder(o, true));
      (acc.data || []).forEach((a) => md_notifyAdminNewAccount(a, true));
    }
  }
}

/* Orders: compare each of the user's orders against the last status we saw. */
async function md_notifPollOrders(silent) {
  if (MD_NOTIF_UID === "guest") return;
  const first = !MD_NOTIF_STATE.ordersInit; // true only the very first time for this account
  const { data } = await supabase
    .from("orders")
    .select("id, order_no, status, fulfillment, created_at")
    .eq("user_id", MD_NOTIF_UID)
    .order("created_at", { ascending: false })
    .limit(20);
  (data || []).forEach((o) => {
    // very first run: just remember current statuses, don't spam old orders
    if (first && MD_NOTIF_STATE.orderStatus[o.id] === undefined) {
      MD_NOTIF_STATE.orderStatus[o.id] = o.status;
      return;
    }
    md_notifyOrderStatus(o);
  });
  MD_NOTIF_STATE.ordersInit = true;
  md_notifSave();
}

function md_notifSubscribeRealtime() {
  supabase
    .channel("notif-products-events")
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "products" }, (pl) => md_notifyProduct(pl.new))
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "events" }, (pl) => md_notifyEvent(pl.new))
    .subscribe();

  if (MD_NOTIF_UID !== "guest") {
    supabase
      .channel("notif-my-orders")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "orders", filter: `user_id=eq.${MD_NOTIF_UID}` }, (pl) => md_notifyOrderStatus(pl.new))
      .subscribe();
    // Backup in case realtime isn't enabled on the orders table
    setInterval(() => md_notifPollOrders(), 60000);
  }
  if (MD_NOTIF_IS_ADMIN) {
    supabase
      .channel("notif-admin-orders")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "orders" }, (pl) => md_notifyAdminNewOrder(pl.new))
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "profiles" }, (pl) => md_notifyAdminNewAccount(pl.new))
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "products" }, (pl) => md_notifyStockChange(pl.new))
      .subscribe();
  }
}

async function md_initNotifications() {
  if (typeof supabase === "undefined" || (typeof CONFIG_OK !== "undefined" && !CONFIG_OK)) return;
  md_renderNotifShell();
  try {
    const session = await md_getSession();
    if (session) {
      MD_NOTIF_UID = session.user.id;
      const profile = await md_getProfile();
      MD_NOTIF_IS_ADMIN = !!(profile && profile.role === "admin");
    }
  } catch (e) {}
  md_notifLoad();
  md_renderNotifs();
  await md_notifCatchUp();
  md_notifSubscribeRealtime();
}

document.addEventListener("DOMContentLoaded", md_initNotifications);
