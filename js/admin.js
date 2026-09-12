/* =========================================================
   Admin dashboard — admin.html
   Tabs: Products | Events | Orders
   ========================================================= */
let MD_ADMIN_PROFILE = null;
let MD_EDITING_PRODUCT_ID = null;
let MD_EDITING_EVENT_ID = null;

async function md_initAdmin() {
  MD_ADMIN_PROFILE = await md_requireAuth({ adminOnly: true });
  if (!MD_ADMIN_PROFILE) return;

  document.getElementById("adminWelcome").textContent = `Signed in as ${MD_ADMIN_PROFILE.full_name || MD_ADMIN_PROFILE.email} (admin)`;

  document.querySelectorAll(".admin-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".admin-tab").forEach((t) => t.classList.remove("active"));
      document.querySelectorAll(".admin-panel").forEach((p) => (p.style.display = "none"));
      tab.classList.add("active");
      document.getElementById(tab.dataset.panel).style.display = "block";
    });
  });

  document.getElementById("logoutBtn")?.addEventListener("click", md_signOut);
  document.getElementById("productForm").addEventListener("submit", md_saveProduct);
  document.getElementById("eventForm").addEventListener("submit", md_saveEvent);
  document.getElementById("resetProductFormBtn").addEventListener("click", md_resetProductForm);
  document.getElementById("resetEventFormBtn").addEventListener("click", md_resetEventForm);
  document.getElementById("pImageFile").addEventListener("change", md_previewProductImage);
  document.getElementById("pHasSizes").addEventListener("change", md_toggleSizeStockFields);

  // Delegated so it survives every products-table re-render; the button
  // only carries data-product-id (never raw product text), so a product
  // name/description containing an apostrophe can't break it.
  document.getElementById("productsTableBody")?.addEventListener("click", (e) => {
    const btn = e.target.closest(".js-edit-product");
    if (!btn) return;
    const product = MD_ADMIN_PRODUCTS_CACHE.find((p) => String(p.id) === btn.dataset.productId);
    if (product) md_editProduct(product);
  });

  md_loadAdminProducts();
  md_initAdminProductFilters();
  md_loadAdminEvents();
  md_loadAdminOrders();
  md_loadAdminAccounts();
  md_initAdminAccountsDelegation();
  md_subscribeAdminRealtime();
}

/* ---------------- Real-time sync ----------------
   Keeps the admin dashboard current the instant stock changes (from a
   sale on the shop, or another admin editing a product) or a new order
   comes in — no refresh needed. */
function md_subscribeAdminRealtime() {
  if (typeof supabase === "undefined") return;

  supabase
    .channel("admin-products-live")
    .on("postgres_changes", { event: "*", schema: "public", table: "products" }, (payload) => {
      if (payload.eventType === "DELETE") {
        MD_ADMIN_PRODUCTS_CACHE = MD_ADMIN_PRODUCTS_CACHE.filter((p) => p.id !== payload.old.id);
      } else {
        const idx = MD_ADMIN_PRODUCTS_CACHE.findIndex((p) => p.id === payload.new.id);
        if (idx >= 0) MD_ADMIN_PRODUCTS_CACHE[idx] = { ...MD_ADMIN_PRODUCTS_CACHE[idx], ...payload.new };
        else MD_ADMIN_PRODUCTS_CACHE.unshift(payload.new);
      }
      md_renderAdminProducts();
    })
    .subscribe();

  supabase
    .channel("admin-orders-live")
    .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => {
      // Order rows can change shape (new order, status update); simplest and
      // safest is to refetch with the order_items join so totals stay correct.
      md_loadAdminOrders();
    })
    .subscribe();

  supabase
    .channel("admin-accounts-live")
    .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, (payload) => {
      if (payload.eventType === "DELETE") {
        MD_ADMIN_ACCOUNTS_CACHE = MD_ADMIN_ACCOUNTS_CACHE.filter((a) => a.id !== payload.old.id);
      } else {
        const idx = MD_ADMIN_ACCOUNTS_CACHE.findIndex((a) => a.id === payload.new.id);
        if (idx >= 0) MD_ADMIN_ACCOUNTS_CACHE[idx] = { ...MD_ADMIN_ACCOUNTS_CACHE[idx], ...payload.new };
        else MD_ADMIN_ACCOUNTS_CACHE.unshift(payload.new);
      }
      md_renderAdminAccounts();
    })
    .subscribe();
}

/* ---------------- PRODUCTS ---------------- */
let MD_ADMIN_PRODUCTS_CACHE = [];
let MD_ADMIN_PRODUCT_FILTER = "merchandise";

async function md_loadAdminProducts() {
  const tbody = document.getElementById("productsTableBody");
  const { data, error } = await supabase.from("products").select("*").order("created_at", { ascending: false });
  if (error) {
    tbody.innerHTML = `<tr><td colspan="8">Error loading products.</td></tr>`;
    return;
  }
  MD_ADMIN_PRODUCTS_CACHE = data;
  md_renderAdminProducts();
}

function md_renderAdminProducts() {
  const tbody = document.getElementById("productsTableBody");
  const items = MD_ADMIN_PRODUCT_FILTER === "collection"
    ? MD_ADMIN_PRODUCTS_CACHE.filter((p) => p.for_sale === false)
    : MD_ADMIN_PRODUCTS_CACHE.filter((p) => p.for_sale !== false);

  if (items.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8">No products in this category yet.</td></tr>`;
    return;
  }

  tbody.innerHTML = items
    .map((p) => {
      const isCollection = p.for_sale === false;
      return `
    <tr>
      <td>${p.name}</td>
      <td>${MD_MUSEUM_LABEL[p.museum_id] || "—"}</td>
      <td><span class="product-category ${isCollection ? "collection" : "merch"}" style="font-size:.68rem;">${isCollection ? "Collection" : "Merchandise"}</span></td>
      <td>₱${Number(p.price).toFixed(2)}</td>
      <td>${md_colorCellHtml(p)}</td>
      <td>${md_stockCellHtml(p)}</td>
      <td>${p.is_active ? "Active" : "Hidden"}</td>
      <td>
        <button class="btn-sm-outline js-edit-product" data-product-id="${p.id}">Edit</button>
        <button class="btn-sm-outline" onclick="md_deleteProduct('${p.id}')">Remove</button>
      </td>
    </tr>`;
    })
    .join("");
}

/** Color column: shows the colors this product is available in (Black,
    White, or both), or a clear "No available color" note when the admin
    hasn't set any. */
function md_colorCellHtml(p) {
  const colors = md_parseColors(p.available_colors);
  if (colors.length === 0) return `<span class="stock-cell-total" style="opacity:.55;font-weight:400;">No available color</span>`;
  return colors.map((c) => `<span class="product-color-pill product-color-${c.toLowerCase()}">${c}</span>`).join(" ");
}

/** Parses the comma-separated available_colors column into a clean array. */
function md_parseColors(raw) {
  return (raw || "")
    .split(",")
    .map((c) => c.trim())
    .filter(Boolean);
}

/** Stock column: shows the per-size breakdown for sized products, or just
    the plain number otherwise — with the running total always visible. */
function md_stockCellHtml(p) {
  if (p.has_sizes && p.size_stock) {
    const order = ["S", "M", "L", "XL"];
    const rows = order.map((s) => `<span class="stock-cell-size">${s}: ${Number(p.size_stock[s]) || 0}</span>`).join("");
    return `<div class="stock-cell-sizes">${rows}</div><div class="stock-cell-total">Total: ${Number(p.stock) || 0}</div>`;
  }
  return `<span class="stock-cell-total">${Number(p.stock) || 0}</span>`;
}

/** Shows the size-by-size inputs instead of the plain stock field, and
    keeps a running "Total stock" readout as the admin types. */
function md_toggleSizeStockFields() {
  const sized = document.getElementById("pHasSizes").checked;
  document.getElementById("pStockField").style.display = sized ? "none" : "block";
  document.getElementById("pSizeStockField").style.display = sized ? "block" : "none";
  if (sized) {
    document.getElementById("pStock").removeAttribute("required");
    md_updateSizeStockTotal();
  } else {
    document.getElementById("pStock").setAttribute("required", "true");
  }
}

function md_updateSizeStockTotal() {
  const s = parseInt(document.getElementById("pStockS").value, 10) || 0;
  const m = parseInt(document.getElementById("pStockM").value, 10) || 0;
  const l = parseInt(document.getElementById("pStockL").value, 10) || 0;
  const xl = parseInt(document.getElementById("pStockXL").value, 10) || 0;
  const total = s + m + l + xl;
  document.getElementById("pSizeStockTotal").textContent = `Total stock: ${total}`;
  document.getElementById("pStock").value = total;
  return total;
}

function md_initAdminProductFilters() {
  const row = document.getElementById("adminProductFilters");
  if (!row) return;
  row.querySelectorAll(".tag-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      row.querySelectorAll(".tag-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      MD_ADMIN_PRODUCT_FILTER = btn.dataset.category;
      md_renderAdminProducts();
    });
  });
}

function md_editProduct(p) {
  MD_EDITING_PRODUCT_ID = p.id;
  document.getElementById("productFormTitle").textContent = "Edit product";
  document.getElementById("pName").value = p.name;
  document.getElementById("pMuseum").value = p.museum_id || "";
  document.getElementById("pPrice").value = p.price;
  const colors = md_parseColors(p.available_colors);
  document.getElementById("pColorBlack").checked = colors.includes("Black");
  document.getElementById("pColorWhite").checked = colors.includes("White");
  document.getElementById("pHasSizes").checked = !!p.has_sizes;
  md_toggleSizeStockFields();
  if (p.has_sizes) {
    const ss = p.size_stock || {};
    document.getElementById("pStockS").value = Number(ss.S) || 0;
    document.getElementById("pStockM").value = Number(ss.M) || 0;
    document.getElementById("pStockL").value = Number(ss.L) || 0;
    document.getElementById("pStockXL").value = Number(ss.XL) || 0;
    md_updateSizeStockTotal();
  } else {
    document.getElementById("pStock").value = p.stock;
  }
  document.getElementById("pImage").value = p.image_url || "";
  document.getElementById("pImageFile").value = "";
  const preview = document.getElementById("pImagePreview");
  if (p.image_url) {
    preview.src = p.image_url;
    preview.style.display = "block";
  } else {
    preview.style.display = "none";
  }
  document.getElementById("pDesc").value = p.description || "";
  document.getElementById("pActive").checked = p.is_active;
  document.getElementById("pCategory").value = p.for_sale === false ? "collection" : "merchandise";
  window.scrollTo({ top: document.getElementById("productForm").offsetTop - 100, behavior: "smooth" });
}

function md_resetProductForm() {
  MD_EDITING_PRODUCT_ID = null;
  document.getElementById("productForm").reset();
  document.getElementById("pImage").value = "";
  document.getElementById("pImageFile").value = "";
  const preview = document.getElementById("pImagePreview");
  preview.src = "";
  preview.style.display = "none";
  document.getElementById("pCategory").value = "merchandise";
  document.getElementById("pColorBlack").checked = false;
  document.getElementById("pColorWhite").checked = false;
  document.getElementById("pHasSizes").checked = false;
  ["pStockS", "pStockM", "pStockL", "pStockXL"].forEach((id) => (document.getElementById(id).value = 0));
  md_toggleSizeStockFields();
  document.getElementById("productFormTitle").textContent = "Add a product";
}

/** Show a local preview the moment the admin picks a file, before it's uploaded */
function md_previewProductImage(e) {
  const file = e.target.files[0];
  if (!file) return;
  const preview = document.getElementById("pImagePreview");
  preview.src = URL.createObjectURL(file);
  preview.style.display = "block";
}

/** Upload the chosen file to Supabase Storage and return its public URL */
async function md_uploadProductImage(file) {
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
  const path = `products/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage.from("product-images").upload(path, file, {
    cacheControl: "3600",
    upsert: false,
  });
  if (error) throw error;
  const { data } = supabase.storage.from("product-images").getPublicUrl(path);
  return data.publicUrl;
}

async function md_saveProduct(e) {
  e.preventDefault();
  const submitBtn = document.getElementById("productForm").querySelector('button[type="submit"]');
  const file = document.getElementById("pImageFile").files[0];
  let imageUrl = document.getElementById("pImage").value.trim();

  if (file) {
    submitBtn.disabled = true;
    submitBtn.textContent = "Uploading image…";
    try {
      imageUrl = await md_uploadProductImage(file);
    } catch (err) {
      alert("Couldn't upload image: " + err.message);
      submitBtn.disabled = false;
      submitBtn.textContent = "Save product";
      return;
    }
  }

  const hasSizes = document.getElementById("pHasSizes").checked;
  const sizeStock = hasSizes
    ? {
        S: parseInt(document.getElementById("pStockS").value, 10) || 0,
        M: parseInt(document.getElementById("pStockM").value, 10) || 0,
        L: parseInt(document.getElementById("pStockL").value, 10) || 0,
        XL: parseInt(document.getElementById("pStockXL").value, 10) || 0,
      }
    : null;
  const totalStock = hasSizes
    ? Object.values(sizeStock).reduce((a, b) => a + b, 0)
    : parseInt(document.getElementById("pStock").value, 10) || 0;

  const payload = {
    name: document.getElementById("pName").value.trim(),
    museum_id: document.getElementById("pMuseum").value || null,
    price: parseFloat(document.getElementById("pPrice").value),
    available_colors:
      [
        document.getElementById("pColorBlack").checked ? "Black" : null,
        document.getElementById("pColorWhite").checked ? "White" : null,
      ]
        .filter(Boolean)
        .join(",") || null,
    has_sizes: hasSizes,
    size_stock: sizeStock,
    stock: totalStock,
    image_url: imageUrl,
    description: document.getElementById("pDesc").value.trim(),
    is_active: document.getElementById("pActive").checked,
    for_sale: document.getElementById("pCategory").value !== "collection",
    updated_at: new Date().toISOString(),
  };

  let error;
  if (MD_EDITING_PRODUCT_ID) {
    ({ error } = await supabase.from("products").update(payload).eq("id", MD_EDITING_PRODUCT_ID));
  } else {
    ({ error } = await supabase.from("products").insert(payload));
  }

  submitBtn.disabled = false;
  submitBtn.textContent = "Save product";

  if (error) {
    alert("Couldn't save product: " + error.message);
    return;
  }
  md_resetProductForm();
  md_loadAdminProducts();
}

async function md_deleteProduct(id) {
  if (!confirm("Remove this product? This can't be undone.")) return;
  const { error } = await supabase.from("products").delete().eq("id", id);
  if (error) {
    // Product is referenced by past orders (order history). Run
    // supabase/fix_product_delete_constraint.sql once to allow real
    // deletion — until then, offer hiding it as a safe fallback.
    if (error.message && /order_items_product_id_fkey/i.test(error.message)) {
      const hideInstead = confirm(
        "This product is part of past orders, so it can't be permanently deleted without breaking that order history.\n\n" +
          "Run supabase/fix_product_delete_constraint.sql in Supabase to allow deleting it anyway.\n\n" +
          "For now, would you like to hide it from the shop instead? (Click OK to hide, Cancel to leave it as is.)"
      );
      if (hideInstead) {
        const { error: hideErr } = await supabase.from("products").update({ is_active: false }).eq("id", id);
        if (hideErr) alert("Couldn't hide product: " + hideErr.message);
        else md_loadAdminProducts();
      }
      return;
    }
    alert("Couldn't remove product: " + error.message);
    return;
  }
  md_loadAdminProducts();
}

/* ---------------- EVENTS ---------------- */
async function md_loadAdminEvents() {
  const tbody = document.getElementById("eventsTableBody");
  const { data, error } = await supabase.from("events").select("*").order("event_date", { ascending: false });
  if (error) {
    tbody.innerHTML = `<tr><td colspan="5">Error loading events.</td></tr>`;
    return;
  }
  tbody.innerHTML = data
    .map(
      (ev) => `
    <tr>
      <td>${ev.title}</td>
      <td>${MD_MUSEUM_LABEL[ev.museum_id] || "—"}</td>
      <td>${md_formatDate(ev.event_date)}</td>
      <td>${ev.event_time || "—"}</td>
      <td>
        <button class="btn-sm-outline" onclick='md_editEvent(${JSON.stringify(ev)})'>Edit</button>
        <button class="btn-sm-outline" onclick="md_deleteEvent('${ev.id}')">Remove</button>
      </td>
    </tr>`
    )
    .join("");
}

function md_formatTime12h(hhmm) {
  if (!hhmm) return "";
  const [h, m] = hhmm.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${period}`;
}

// Best-effort: turn an old free-typed time string like "2:00 PM – 5:00 PM"
// back into 24h HH:MM values so the pickers can be pre-filled when editing.
function md_parseTimeRangeFor24h(str) {
  if (!str) return { start: "", end: "" };
  const parts = str.split(/[–\-]/).map((s) => s.trim());
  const to24 = (t) => {
    const m = t.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
    if (!m) return "";
    let h = Number(m[1]);
    const min = m[2];
    const ap = (m[3] || "").toUpperCase();
    if (ap === "PM" && h !== 12) h += 12;
    if (ap === "AM" && h === 12) h = 0;
    return `${String(h).padStart(2, "0")}:${min}`;
  };
  return { start: to24(parts[0] || ""), end: to24(parts[1] || "") };
}

function md_editEvent(ev) {
  MD_EDITING_EVENT_ID = ev.id;
  document.getElementById("eventFormTitle").textContent = "Edit event";
  document.getElementById("eTitle").value = ev.title;
  document.getElementById("eMuseum").value = ev.museum_id || "";
  document.getElementById("eDate").value = ev.event_date;
  const parsed = md_parseTimeRangeFor24h(ev.event_time || "");
  document.getElementById("eTimeStart").value = parsed.start;
  document.getElementById("eTimeEnd").value = parsed.end;
  document.getElementById("eImage").value = ev.image_url || "";
  document.getElementById("eDesc").value = ev.description || "";
  window.scrollTo({ top: document.getElementById("eventForm").offsetTop - 100, behavior: "smooth" });
}

function md_resetEventForm() {
  MD_EDITING_EVENT_ID = null;
  document.getElementById("eventForm").reset();
  document.getElementById("eventFormTitle").textContent = "Add an event";
}

async function md_saveEvent(e) {
  e.preventDefault();
  const start = md_formatTime12h(document.getElementById("eTimeStart").value);
  const end = md_formatTime12h(document.getElementById("eTimeEnd").value);
  const event_time = start && end ? `${start} – ${end}` : start || end || "";

  const payload = {
    title: document.getElementById("eTitle").value.trim(),
    museum_id: document.getElementById("eMuseum").value || null,
    event_date: document.getElementById("eDate").value,
    event_time,
    image_url: document.getElementById("eImage").value.trim(),
    description: document.getElementById("eDesc").value.trim(),
  };

  let error;
  if (MD_EDITING_EVENT_ID) {
    ({ error } = await supabase.from("events").update(payload).eq("id", MD_EDITING_EVENT_ID));
  } else {
    ({ error } = await supabase.from("events").insert(payload));
  }

  if (error) {
    alert("Couldn't save event: " + error.message);
    return;
  }
  md_resetEventForm();
  md_loadAdminEvents();
}

async function md_deleteEvent(id) {
  if (!confirm("Remove this event?")) return;
  const { error } = await supabase.from("events").delete().eq("id", id);
  if (error) {
    alert("Couldn't remove event: " + error.message);
    return;
  }
  md_loadAdminEvents();
}

/* ---------------- ORDERS ---------------- */
let MD_ADMIN_ORDERS_CACHE = [];
const MD_ORDER_STATUSES = ["pending", "paid", "preparing", "ready", "completed", "cancelled"];

async function md_loadAdminOrders() {
  const tbody = document.getElementById("ordersTableBody");
  // Nested select pulls each order's line items in the same request, so
  // order details are ready to show instantly with no extra round-trip.
  const { data, error } = await supabase
    .from("orders")
    .select("*, order_items(*)")
    .order("created_at", { ascending: false });
  if (error) {
    tbody.innerHTML = `<tr><td colspan="8">Error loading orders.</td></tr>`;
    console.error(error);
    return;
  }
  MD_ADMIN_ORDERS_CACHE = data || [];
  md_renderAdminOrders();
}

function md_renderAdminOrders() {
  const tbody = document.getElementById("ordersTableBody");
  if (MD_ADMIN_ORDERS_CACHE.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8">No orders yet.</td></tr>`;
    return;
  }
  tbody.innerHTML = MD_ADMIN_ORDERS_CACHE
    .map((o) => {
      const items = o.order_items || [];
      return `
    <tr class="order-row-toggle" onclick="md_toggleOrderDetails('${o.id}')">
      <td class="order-toggle-arrow" id="arrow-${o.id}">▸</td>
      <td>${o.order_no}</td>
      <td>${o.guest_name}<br><span style="opacity:.6;font-size:.78rem;">${o.guest_email}</span></td>
      <td>${o.fulfillment === "online" ? "Delivery" : "Pickup"}</td>
      <td>${(o.payment_method || "").toUpperCase()}${o.payment_reference ? `<br><span style="opacity:.6;font-size:.78rem;">Ref: ${o.payment_reference}</span>` : ""}</td>
      <td>₱${Number(o.total).toFixed(2)}</td>
      <td onclick="event.stopPropagation()">
        <select onchange="md_updateOrderStatus('${o.id}', this.value)">
          ${MD_ORDER_STATUSES.map((s) => `<option value="${s}" ${s === o.status ? "selected" : ""}>${s}</option>`).join("")}
        </select>
      </td>
      <td onclick="event.stopPropagation()"><a href="receipt.html?order_no=${o.order_no}" target="_blank" class="btn-sm-outline" style="text-decoration:none;">Receipt</a></td>
    </tr>
    <tr class="order-details-row" id="orderDetails-${o.id}" style="display:none;">
      <td colspan="8">
        <div class="order-details-wrap">
          <div class="order-meta-line">${items.length} item${items.length === 1 ? "" : "s"} · ${o.fulfillment === "online" ? `Delivering to: ${o.delivery_address || "—"}` : "Walk-in pickup"} · Placed ${md_formatTimestamp(o.created_at)}</div>
          <table>
            <thead><tr><th>Item</th><th>Qty</th><th>Unit price</th><th>Line total</th></tr></thead>
            <tbody>
              ${
                items.length
                  ? items
                      .map(
                        (i) =>
                          `<tr><td>${i.product_name}</td><td>${i.quantity}</td><td>₱${Number(i.unit_price).toFixed(2)}</td><td>₱${Number(i.line_total).toFixed(2)}</td></tr>`
                      )
                      .join("")
                  : `<tr><td colspan="4">No item details recorded for this order.</td></tr>`
              }
            </tbody>
          </table>
        </div>
      </td>
    </tr>`;
    })
    .join("");
}

function md_toggleOrderDetails(id) {
  const row = document.getElementById(`orderDetails-${id}`);
  const arrow = document.getElementById(`arrow-${id}`);
  if (!row) return;
  const isOpen = row.style.display !== "none";
  row.style.display = isOpen ? "none" : "table-row";
  if (arrow) arrow.textContent = isOpen ? "▸" : "▾";
}

async function md_updateOrderStatus(id, status) {
  const { error } = await supabase.from("orders").update({ status }).eq("id", id);
  if (error) {
    alert("Couldn't update status: " + error.message);
    return;
  }

  // Cancelling an order puts its items' stock back — real-time, and only once.
  if (status === "cancelled") {
    const order = MD_ADMIN_ORDERS_CACHE.find((o) => o.id === id);
    if (order && !order.stock_restored) {
      const items = order.order_items || [];
      for (const item of items) {
        const nameSizeMatch = /\(Size (\w+)/.exec(item.product_name || "");
        await supabase.rpc("increment_product_stock", {
          p_product_id: item.product_id,
          p_qty: item.quantity,
          p_size: nameSizeMatch ? nameSizeMatch[1] : null,
        });
      }
      await supabase.from("orders").update({ stock_restored: true }).eq("id", id);
    }
  }
  md_loadAdminOrders();
}

/** Formats a real ISO timestamp column (e.g. Supabase's created_at) for
    display — Sep 12, 2026. This is deliberately separate from events.js's
    md_formatDate(), which is only for plain "YYYY-MM-DD" date columns and
    appends "T00:00:00" before parsing; doing that to an already-complete
    timestamp (which has its own time/timezone) corrupts it into an
    invalid date, which is why "Joined" and order dates showed nothing. */
function md_formatTimestamp(isoString) {
  if (!isoString) return "—";
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });
}

document.addEventListener("DOMContentLoaded", md_initAdmin);

/* ---------------- Accounts ----------------
   Lists everyone who has signed up, with their email-verification
   status and role. Verified status is synced from auth.users into
   profiles.email_verified by a database trigger — see
   sql/003_accounts.sql — because the browser can't read auth.users
   directly. */
let MD_ADMIN_ACCOUNTS_CACHE = [];

async function md_loadAdminAccounts() {
  const tbody = document.getElementById("accountsTableBody");
  if (!tbody) return;
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) {
    tbody.innerHTML = `<tr><td colspan="7">Couldn't load accounts: ${error.message}</td></tr>`;
    console.error(error);
    return;
  }
  MD_ADMIN_ACCOUNTS_CACHE = data || [];
  md_renderAdminAccounts();
}

function md_renderAdminAccounts() {
  const tbody = document.getElementById("accountsTableBody");
  if (!tbody) return;
  if (MD_ADMIN_ACCOUNTS_CACHE.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7">No accounts yet.</td></tr>`;
    return;
  }
  tbody.innerHTML = MD_ADMIN_ACCOUNTS_CACHE.map((a) => {
    const isSelf = MD_ADMIN_PROFILE && a.id === MD_ADMIN_PROFILE.id;
    return `
    <tr>
      <td>${a.full_name || "—"}${isSelf ? ` <span style="opacity:.5;font-size:.75rem;">(you)</span>` : ""}</td>
      <td>${a.email}</td>
      <td>${a.phone || "—"}</td>
      <td><span class="acct-badge ${a.email_verified ? "verified" : "pending"}">${a.email_verified ? "Verified" : "Pending"}</span></td>
      <td><span class="acct-badge ${a.role === "admin" ? "admin" : "customer"}">${a.role}</span></td>
      <td style="opacity:.75;font-size:.85rem;">${md_formatTimestamp(a.created_at)}</td>
      <td>
        ${
          isSelf
            ? `<span style="opacity:.5;font-size:.8rem;">—</span>`
            : `<button class="btn-sm-outline js-toggle-role" data-account-id="${a.id}" data-new-role="${a.role === "admin" ? "customer" : "admin"}">${a.role === "admin" ? "Make customer" : "Make admin"}</button>
               <button class="btn-sm-outline js-delete-account" data-account-id="${a.id}" style="margin-left:6px;color:#b42318;border-color:#b42318;">Delete</button>`
        }
      </td>
    </tr>`;
  }).join("");
}

/* Delegated (same reasoning as the shop's Add-to-basket fix): buttons only
   carry data-account-id/data-new-role, an id and a fixed "admin"/"customer"
   string — never a person's name or email — so nothing in someone's profile
   text can ever break these buttons. */
function md_initAdminAccountsDelegation() {
  const tbody = document.getElementById("accountsTableBody");
  if (!tbody) return;
  tbody.addEventListener("click", (e) => {
    const roleBtn = e.target.closest(".js-toggle-role");
    if (roleBtn) {
      md_toggleAccountRole(roleBtn.dataset.accountId, roleBtn.dataset.newRole);
      return;
    }
    const delBtn = e.target.closest(".js-delete-account");
    if (delBtn) {
      md_deleteAccount(delBtn.dataset.accountId);
    }
  });
}

async function md_toggleAccountRole(id, newRole) {
  if (!confirm(`Change this account's role to "${newRole}"?`)) return;
  const { error } = await supabase.from("profiles").update({ role: newRole }).eq("id", id);
  if (error) {
    alert("Couldn't update role: " + error.message);
    return;
  }
  md_loadAdminAccounts();
}

/* Deletes the person's profile row only. Their Supabase Auth login isn't
   removed by this — the browser can't do that safely (it would need the
   service-role key, which must never ship to client-side code). Fully
   deleting the login too requires a secure server-side call (e.g. a
   Supabase Edge Function using supabase.auth.admin.deleteUser). */
async function md_deleteAccount(id) {
  if (
    !confirm(
      "Delete this account's profile record? This can't be undone.\n\nNote: this removes them from this list, but does NOT delete their login from Supabase Auth — that needs to be done separately from the Supabase dashboard (or a secure server-side function)."
    )
  )
    return;
  const { error } = await supabase.from("profiles").delete().eq("id", id);
  if (error) {
    alert("Couldn't delete account: " + error.message);
    return;
  }
  md_loadAdminAccounts();
}
