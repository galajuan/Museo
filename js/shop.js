/* =========================================================
   Shop — product grid + checkout (shop.html)
   ========================================================= */
let MD_PRODUCTS_CACHE = [];
let MD_ACTIVE_FILTER = "all";

const MD_PAYMENT_INFO = {
  gcash: { label: "GCash", detail: "Send to 0917-123-4567 (MuseoDavao Shop). Enter your reference number below." },
  bdo: { label: "BDO", detail: "Bank transfer to BDO Savings 0012-3456-7890 (MuseoDavao Shop Inc.). Enter your reference number below." },
  bpi: { label: "BPI", detail: "Bank transfer to BPI Savings 9988-7766-5544 (MuseoDavao Shop Inc.). Enter your reference number below." },
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
}

function md_renderProducts() {
  const grid = document.getElementById("productGrid");
  if (!grid) return;
  const items =
    MD_ACTIVE_FILTER === "all"
      ? MD_PRODUCTS_CACHE
      : MD_PRODUCTS_CACHE.filter((p) => p.museum_id === MD_ACTIVE_FILTER);

  if (items.length === 0) {
    grid.innerHTML = `<p class="empty-note">No items in this collection yet.</p>`;
    return;
  }

  grid.innerHTML = items
    .map(
      (p) => `
    <div class="product-card">
      <div class="product-media">${p.image_url ? `<img src="${p.image_url}" alt="${p.name}">` : `<span class="ph">No image yet</span>`}</div>
      <div class="product-body">
        <span class="product-museum">${MD_MUSEUM_LABEL[p.museum_id] || "MuseoDavao"}</span>
        <h4>${p.name}</h4>
        <p class="product-desc">${p.description || ""}</p>
        <div class="product-foot">
          <span class="price">₱${Number(p.price).toFixed(2)}</span>
          <span class="stock-note">${p.for_sale === false ? "Collection item" : p.stock > 0 ? p.stock + " in stock" : "Out of stock"}</span>
        </div>
        ${
          p.for_sale === false
            ? `<button class="btn-sm" style="width:100%;margin-top:6px;" disabled>Not for sale</button>`
            : `<button class="btn-sm" style="width:100%;margin-top:6px;" ${p.stock <= 0 ? "disabled" : ""} onclick='md_addToCart(${JSON.stringify(p)})'>
          ${p.stock <= 0 ? "Out of stock" : "Add to basket"}
        </button>`
        }
      </div>
    </div>`
    )
    .join("");
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
    cart.map((i) => `<div class="cart-total-row"><span>${i.name} × ${i.qty}</span><span>₱${(i.price * i.qty).toFixed(2)}</span></div>`).join("") +
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
    errEl.textContent = "Couldn't place your order — please check your Supabase connection and try again.";
    errEl.style.display = "block";
    btn.disabled = false;
    btn.textContent = "Place order";
    return;
  }

  const items = cart.map((i) => ({
    order_id: order.id,
    product_id: i.id,
    product_name: i.name,
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
  md_initShopFilters();
  const form = document.getElementById("checkoutForm");
  if (form) {
    form.addEventListener("submit", md_placeOrder);
    document.querySelectorAll('input[name="paymentMethod"]').forEach((r) => r.addEventListener("change", md_updatePaymentDetail));
    document.querySelectorAll('input[name="fulfillment"]').forEach((r) => r.addEventListener("change", md_updateFulfillmentUI));
    md_updatePaymentDetail();
    md_updateFulfillmentUI();
  }
});
