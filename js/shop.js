/* =========================================================
   Shop — product grid + checkout (shop.html)
   ========================================================= */
let MD_PRODUCTS_CACHE = [];
let MD_ACTIVE_FILTER = "all";
let MD_ACTIVE_CATEGORY = "all";
let MD_SEARCH_QUERY = "";

const MD_PAYMENT_INFO = {
  gcash: { label: "GCash", detail: "Send to 09128461404 (MuseoDavao Shop). Enter your reference number below." },
  bdo: { label: "BDO", detail: "Bank transfer to BDO Savings 0032-6027-0048 (MuseoDavao Shop Inc.). Enter your reference number below." },
  bpi: { label: "BPI", detail: "Bank transfer to BPI Savings  (MuseoDavao Shop Inc.). Enter your reference number below." },
  cash: { label: "Cash", detail: "Pay in cash upon pickup (walk-in) or upon delivery (online order)." },
};

async function md_loadProducts() {
  const grid = document.getElementById("productGrid");
  if (!grid) return;

  if (typeof CONFIG_OK !== "undefined" && !CONFIG_OK) {
    grid.innerHTML = `<p class="empty-note">Connect Supabase to load products. See README.md.</p>`;
    return;
  }

  const { data, error } = await supabase
    .from("products")
    .select("*")
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  if (error) {
    grid.innerHTML = `<p class="empty-note">Couldn't load the shop right now.</p>`;
    console.error(error);
    return;
  }

  MD_PRODUCTS_CACHE = data || [];
  md_renderProducts();
  md_subscribeShopRealtime();
}

/* ---------------- Real-time stock sync ----------------
   Any stock change made in the admin dashboard, or by another
   shopper checking out right now, is pushed here instantly so the
   numbers on this page (and the Add-to-basket buttons) stay accurate
   without anyone refreshing. */
let MD_SHOP_REALTIME_CHANNEL = null;

function md_subscribeShopRealtime() {
  if (MD_SHOP_REALTIME_CHANNEL || typeof supabase === "undefined" || !CONFIG_OK) return;
  MD_SHOP_REALTIME_CHANNEL = supabase
    .channel("shop-products-live")
    .on("postgres_changes", { event: "*", schema: "public", table: "products" }, (payload) => {
      if (payload.eventType === "DELETE") {
        MD_PRODUCTS_CACHE = MD_PRODUCTS_CACHE.filter((p) => p.id !== payload.old.id);
      } else {
        const updated = payload.new;
        const idx = MD_PRODUCTS_CACHE.findIndex((p) => p.id === updated.id);
        if (idx >= 0) MD_PRODUCTS_CACHE[idx] = { ...MD_PRODUCTS_CACHE[idx], ...updated };
        else if (updated.is_active) MD_PRODUCTS_CACHE.unshift(updated);
      }
      md_renderProducts();
    })
    .subscribe();
}

function md_renderProducts() {
  const grid = document.getElementById("productGrid");
  if (!grid) return;
  let items =
    MD_ACTIVE_FILTER === "all"
      ? MD_PRODUCTS_CACHE
      : MD_PRODUCTS_CACHE.filter((p) => p.museum_id === MD_ACTIVE_FILTER);

  if (MD_ACTIVE_CATEGORY === "merchandise") {
    items = items.filter((p) => p.for_sale !== false);
  } else if (MD_ACTIVE_CATEGORY === "collection") {
    items = items.filter((p) => p.for_sale === false);
  }

  const q = MD_SEARCH_QUERY.trim().toLowerCase();
  if (q) {
    items = items.filter(
      (p) =>
        (p.name || "").toLowerCase().includes(q) ||
        (p.description || "").toLowerCase().includes(q) ||
        (MD_MUSEUM_LABEL[p.museum_id] || "").toLowerCase().includes(q)
    );
  }

  if (items.length === 0) {
    grid.innerHTML = q
      ? `<p class="empty-note">No items match "${MD_SEARCH_QUERY}". Try a different search.</p>`
      : `<p class="empty-note">No items in this collection yet.</p>`;
    return;
  }

  grid.innerHTML = items.map((p) => md_productCardHtml(p)).join("");
}

const MD_SIZE_ORDER = ["S", "M", "L", "XL"];

/** Parses the comma-separated available_colors column into a clean array. */
function md_parseColors(raw) {
  return (raw || "")
    .split(",")
    .map((c) => c.trim())
    .filter(Boolean);
}

function md_productCardHtml(p) {
  const sizeId = `size-${p.id}`;
  const colorId = `color-${p.id}`;
  const qtyId = `qty-${p.id}`;
  const showSize = typeof md_needsSize === "function" && md_needsSize(p) && p.for_sale !== false;
  const isCollection = p.for_sale === false;
  const sizeStock = p.size_stock || {};
  const totalStock = Number(p.stock) || 0;
  const colorOptions = md_parseColors(p.available_colors);
  const showColor = colorOptions.length > 0 && !isCollection;

  // For sized items, the "current" size defaults to whichever the shopper
  // already had selected, or the first size that still has stock.
  const prevSel = document.getElementById(sizeId)?.value;
  const defaultSize =
    prevSel && sizeStock[prevSel] > 0
      ? prevSel
      : MD_SIZE_ORDER.find((s) => (Number(sizeStock[s]) || 0) > 0) || MD_SIZE_ORDER[0];
  const stockForSelectedSize = showSize ? Number(sizeStock[defaultSize]) || 0 : totalStock;

  // Same idea for color — keep whatever the shopper had picked if it's
  // still a valid option for this product.
  const prevColorSel = document.getElementById(colorId)?.value;
  const defaultColor = prevColorSel && colorOptions.includes(prevColorSel) ? prevColorSel : colorOptions[0];

  const stockNoteClass = totalStock <= 0 ? "out" : totalStock <= 5 ? "low" : "";
  const stockNoteText = isCollection
    ? "Collection item"
    : totalStock > 0
    ? `${totalStock} in stock`
    : "Out of stock";

  const sizeOptions = showSize
    ? MD_SIZE_ORDER.map((s) => {
        const left = Number(sizeStock[s]) || 0;
        const label = left > 0 ? `${s} — ${left} left` : `${s} — sold out`;
        return `<option value="${s}" ${s === defaultSize ? "selected" : ""} ${left <= 0 ? "disabled" : ""}>${label}</option>`;
      }).join("")
    : "";

  const colorSelectOptions = showColor
    ? colorOptions.map((c) => `<option value="${c}" ${c === defaultColor ? "selected" : ""}>${c}</option>`).join("")
    : "";

  const disableAdd = isCollection || totalStock <= 0 || (showSize && stockForSelectedSize <= 0);

  return `
    <div class="product-card" data-product-id="${p.id}">
      <div class="product-media">${
        p.image_url
          ? `${md_zoomableImg(p.image_url, p.name)}<span class="zoom-hint">🔍</span>`
          : `<span class="ph">No image yet</span>`
      }</div>
      <div class="product-body">
        <span class="product-museum">${MD_MUSEUM_LABEL[p.museum_id] || "MuseoDavao"}</span>
        <span class="product-category ${isCollection ? "collection" : "merch"}">${isCollection ? "Collection" : "Merchandise"}</span>
        <h4>${p.name}</h4>
        <p class="product-desc">${p.description || ""}</p>
        ${
          !isCollection
            ? showColor
              ? `<div class="size-field"><label for="${colorId}">Color</label>
                  <select id="${colorId}" class="size-select" onchange="md_onSizeChange('${p.id}')">
                    ${colorSelectOptions}
                  </select>`
              : `<div class="product-color-row">Color: <span style="opacity:.55;">No available color</span></div>`
            : ""
        }
        ${
          showSize
            ? `<div class="size-field"><label for="${sizeId}">Size</label>
                <select id="${sizeId}" class="size-select" onchange="md_onSizeChange('${p.id}')">
                  ${sizeOptions}
                </select>
                <div class="size-stock-hint ${stockForSelectedSize <= 3 && stockForSelectedSize > 0 ? "low" : ""}" id="sizehint-${p.id}">
                  ${stockForSelectedSize > 0 ? `${stockForSelectedSize} left in size ${defaultSize}` : "This size is sold out"}
                </div>`
            : ""
        }
        ${!isCollection && stockForSelectedSize > 0 ? md_qtyFieldHtml(qtyId, stockForSelectedSize, p.price) : ""}
        <div class="product-foot">
          <span class="price">₱${Number(p.price).toFixed(2)}</span>
          <span class="stock-note ${stockNoteClass}">${stockNoteText}</span>
        </div>
        ${
          p.for_sale === false
            ? `<button class="btn-sm" style="width:100%;margin-top:6px;" disabled>Not for sale</button>`
            : `<button class="btn-sm" style="width:100%;margin-top:6px;" ${disableAdd ? "disabled" : ""} onclick='md_addToCartFromCard(${JSON.stringify(p)}, ${showSize ? `"${sizeId}"` : "null"}, ${stockForSelectedSize > 0 ? `"${qtyId}"` : "null"}, ${showColor ? `"${colorId}"` : "null"})'>
          ${disableAdd ? "Out of stock" : "Add to basket"}
        </button>`
        }
      </div>
    </div>`;
}

/** Re-render just the one card when the shopper switches sizes, so the
    quantity max / hint / button update to match that size's stock. */
function md_onSizeChange(productId) {
  const p = MD_PRODUCTS_CACHE.find((pr) => String(pr.id) === String(productId));
  if (!p) return;
  const card = document.querySelector(`.product-card[data-product-id="${productId}"]`);
  if (!card) return;
  card.outerHTML = md_productCardHtml(p);
}

function md_initShopSearch() {
  const input = document.getElementById("shopSearchInput");
  if (!input) return;
  input.addEventListener("input", () => {
    MD_SEARCH_QUERY = input.value;
    md_renderProducts();
  });
}

function md_initShopFilters() {
  const tagRow = document.getElementById("shopFilters");
  if (!tagRow) return;
  tagRow.querySelectorAll(".tag-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      tagRow.querySelectorAll(".tag-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      MD_ACTIVE_FILTER = btn.dataset.filter;
      md_renderProducts();
    });
  });
}

function md_initShopCategoryFilters() {
  const row = document.getElementById("shopCategoryFilters");
  if (!row) return;
  row.querySelectorAll(".tag-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      row.querySelectorAll(".tag-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      MD_ACTIVE_CATEGORY = btn.dataset.category;
      md_renderProducts();
    });
  });
}

/* ---------------- Checkout ---------------- */

function md_renderCheckoutSummary() {
  const wrap = document.getElementById("checkoutSummary");
  if (!wrap) return;
  const cart = md_getCart();
  if (cart.length === 0) {
    wrap.innerHTML = `<p class="empty-note">Your basket is empty — add something from the shop above first.</p>`;
    document.getElementById("placeOrderBtn")?.setAttribute("disabled", "true");
    return;
  }
  document.getElementById("placeOrderBtn")?.removeAttribute("disabled");
  wrap.innerHTML =
    cart.map((i) => `<div class="cart-total-row"><span>${md_cartItemLabel(i)} × ${i.qty}</span><span>₱${(i.price * i.qty).toFixed(2)}</span></div>`).join("") +
    `<div class="cart-total-row" style="border-top:1px solid var(--line);padding-top:10px;margin-top:10px;font-weight:600;"><span>Total</span><span>₱${md_cartSubtotal().toFixed(2)}</span></div>`;
}

function md_updatePaymentDetail() {
  const method = document.querySelector('input[name="paymentMethod"]:checked')?.value;
  const box = document.getElementById("paymentDetailBox");
  const refField = document.getElementById("refField");
  if (!method || !box) return;
  const info = MD_PAYMENT_INFO[method];
  box.textContent = info.detail;
  refField.style.display = method === "cash" ? "none" : "block";
}

function md_updateFulfillmentUI() {
  const val = document.querySelector('input[name="fulfillment"]:checked')?.value;
  const addr = document.getElementById("deliveryAddressField");
  if (addr) addr.style.display = val === "online" ? "block" : "none";
}

function md_generateOrderNo() {
  const rand = Math.floor(1000 + Math.random() * 9000);
  const stamp = Date.now().toString().slice(-6);
  return `MD-${stamp}${rand}`;
}

async function md_placeOrder(e) {
  e.preventDefault();
  const cart = md_getCart();
  if (cart.length === 0) return;

  const errEl = document.getElementById("checkoutError");
  errEl.style.display = "none";

  const fulfillment = document.querySelector('input[name="fulfillment"]:checked')?.value;
  const paymentMethod = document.querySelector('input[name="paymentMethod"]:checked')?.value;
  const name = document.getElementById("checkoutName").value.trim();
  const email = document.getElementById("checkoutEmail").value.trim();
  const phone = document.getElementById("checkoutPhone").value.trim();
  const address = document.getElementById("checkoutAddress").value.trim();
  const reference = document.getElementById("checkoutReference").value.trim();

  if (!name || !email || !phone) {
    errEl.textContent = "Please fill in your name, email, and phone number.";
    errEl.style.display = "block";
    return;
  }
  if (fulfillment === "online" && !address) {
    errEl.textContent = "Please add a delivery address for online orders.";
    errEl.style.display = "block";
    return;
  }
  if (paymentMethod !== "cash" && !reference) {
    errEl.textContent = "Please enter your payment reference number.";
    errEl.style.display = "block";
    return;
  }

  const btn = document.getElementById("placeOrderBtn");
  btn.disabled = true;
  btn.textContent = "Checking stock...";

  /* Reserve stock FIRST, one item at a time, using the atomic RPC function.
     This is what keeps inventory accurate in real time even if two people
     are checking out at once — the database itself rejects overselling.
     If any item fails (someone beat you to the last one), everything
     already reserved in this loop is put back and no order is created. */
  const reserved = [];
  for (const item of cart) {
    const { data: updatedProduct, error: stockErr } = await supabase.rpc("decrement_product_stock", {
      p_product_id: item.id,
      p_qty: item.qty,
      p_size: item.size || null,
    });
    if (stockErr) {
      // Roll back anything already reserved in this checkout attempt
      for (const r of reserved) {
        await supabase.rpc("increment_product_stock", { p_product_id: r.id, p_qty: r.qty, p_size: r.size || null });
      }
      errEl.textContent = `Sorry — "${md_cartItemLabel(item)}" ${stockErr.message.includes("Only") ? stockErr.message.toLowerCase() : "just sold out"}. Please update your basket and try again.`;
      errEl.style.display = "block";
      btn.disabled = false;
      btn.textContent = "Place order";
      md_loadProducts(); // refresh so the shopper sees current stock
      return;
    }
    reserved.push(item);
    // Keep the local cache fresh in case the realtime event hasn't arrived yet
    const idx = MD_PRODUCTS_CACHE.findIndex((p) => p.id === item.id);
    if (idx >= 0 && updatedProduct) MD_PRODUCTS_CACHE[idx] = { ...MD_PRODUCTS_CACHE[idx], ...updatedProduct };
  }

  btn.textContent = "Placing order...";

  const subtotal = md_cartSubtotal();
  const session = typeof md_getSession === "function" ? await md_getSession() : null;
  const orderNo = md_generateOrderNo();

  const orderPayload = {
    order_no: orderNo,
    user_id: session ? session.user.id : null,
    guest_name: name,
    guest_email: email,
    guest_phone: phone,
    fulfillment,
    delivery_address: fulfillment === "online" ? address : null,
    payment_method: paymentMethod,
    payment_reference: paymentMethod === "cash" ? null : reference,
    status: paymentMethod === "cash" ? "pending" : "pending",
    subtotal,
    total: subtotal,
  };

  const { data: order, error: orderErr } = await supabase.from("orders").insert(orderPayload).select().single();

  if (orderErr) {
    console.error(orderErr);
    // Order record failed to save — put the reserved stock back so it isn't lost
    for (const r of reserved) {
      await supabase.rpc("increment_product_stock", { p_product_id: r.id, p_qty: r.qty, p_size: r.size || null });
    }
    errEl.textContent = "Couldn't place your order — please check your Supabase connection and try again.";
    errEl.style.display = "block";
    btn.disabled = false;
    btn.textContent = "Place order";
    md_loadProducts();
    return;
  }

  const items = cart.map((i) => ({
    order_id: order.id,
    product_id: i.id,
    product_name: md_cartItemLabel(i),
    unit_price: i.price,
    quantity: i.qty,
    line_total: i.price * i.qty,
  }));
  const { error: itemsErr } = await supabase.from("order_items").insert(items);
  if (itemsErr) console.error(itemsErr);

  // Save last order for the receipt page
  localStorage.setItem(
    "museodavao_last_order",
    JSON.stringify({ order: { ...order, ...orderPayload }, items: cart })
  );

  md_clearCart();
  window.location.href = "receipt.html";
}

document.addEventListener("DOMContentLoaded", () => {
  md_loadProducts();
  md_initShopSearch();
  md_initShopFilters();
  md_initShopCategoryFilters();
  const form = document.getElementById("checkoutForm");
  if (form) {
    form.addEventListener("submit", md_placeOrder);
    document.querySelectorAll('input[name="paymentMethod"]').forEach((r) => r.addEventListener("change", md_updatePaymentDetail));
    document.querySelectorAll('input[name="fulfillment"]').forEach((r) => r.addEventListener("change", md_updateFulfillmentUI));
    md_updatePaymentDetail();
    md_updateFulfillmentUI();
  }
});
