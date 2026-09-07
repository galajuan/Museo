/* =========================================================
   Cart — persisted in localStorage so it survives across pages
   Cart item shape: { id, name, price, image_url, qty, museum_id, size }
   ========================================================= */
const MD_CART_KEY = "museodavao_cart_v1";

/* T-shirts (currently National Museum merch) sell in sizes.
   Anything else ignores size entirely. */
function md_needsSize(product) {
  return product && product.museum_id === "national" && /shirt/i.test(product.name || "");
}

function md_getCart() {
  try {
    return JSON.parse(localStorage.getItem(MD_CART_KEY)) || [];
  } catch (e) {
    return [];
  }
}

function md_saveCart(cart) {
  localStorage.setItem(MD_CART_KEY, JSON.stringify(cart));
  md_renderCart();
}

function md_addToCart(product, qty = 1, size = null) {
  const cart = md_getCart();
  const existing = cart.find((i) => i.id === product.id && (i.size || null) === (size || null));
  if (existing) {
    existing.qty += qty;
  } else {
    cart.push({
      id: product.id,
      name: product.name,
      price: Number(product.price),
      image_url: product.image_url || "",
      qty,
      museum_id: product.museum_id || "",
      size: size || null,
    });
  }
  md_saveCart(cart);
  md_toast(size ? `Added "${product.name}" (Size ${size}) to your basket` : `Added "${product.name}" to your basket`);
  md_openCart();
}

/* Used by product cards that render a size <select> — reads the chosen
   size (if the product needs one) before adding to the basket. */
function md_addToCartFromCard(product, sizeSelectId) {
  let size = null;
  if (sizeSelectId) {
    const sel = document.getElementById(sizeSelectId);
    if (sel && sel.value) size = sel.value;
  }
  if (md_needsSize(product) && !size) {
    md_toast("Please choose a size first");
    return;
  }
  md_addToCart(product, 1, size);
}

function md_updateQty(id, delta, size = null) {
  const cart = md_getCart();
  const item = cart.find((i) => i.id === id && (i.size || null) === (size || null));
  if (!item) return;
  item.qty += delta;
  const filtered = item.qty <= 0 ? cart.filter((i) => i !== item) : cart;
  md_saveCart(filtered);
}

function md_removeFromCart(id, size = null) {
  md_saveCart(md_getCart().filter((i) => !(i.id === id && (i.size || null) === (size || null))));
}

function md_clearCart() {
  md_saveCart([]);
}

function md_cartSubtotal() {
  return md_getCart().reduce((sum, i) => sum + i.price * i.qty, 0);
}

function md_renderCart() {
  const wrap = document.getElementById("cartItemsWrap");
  const cart = md_getCart();
  const countEls = document.querySelectorAll("#cartCountHeader");
  const totalQty = cart.reduce((s, i) => s + i.qty, 0);
  countEls.forEach((el) => (el.textContent = totalQty));

  if (wrap) {
    wrap.innerHTML = cart.length
      ? cart
          .map(
            (i) => `
        <div class="cart-item">
          <div class="cimg">${
            i.image_url ? `<img src="${i.image_url}" alt="${i.name}">` : ""
          }</div>
          <div class="cinfo">
            <h6>${i.name}${i.size ? ` <span style="opacity:.6;font-weight:400;">— Size ${i.size}</span>` : ""}</h6>
            <div class="qty-ctl">
              <button onclick="md_updateQty('${i.id}',-1,${i.size ? `'${i.size}'` : "null"})">−</button>
              <span>${i.qty}</span>
              <button onclick="md_updateQty('${i.id}',1,${i.size ? `'${i.size}'` : "null"})">+</button>
              <span style="margin-left:auto;font-family:var(--mono);">₱${(i.price * i.qty).toFixed(2)}</span>
            </div>
          </div>
        </div>`
          )
          .join("")
      : `<p class="empty-note">Your basket is empty. Visit the <a href="shop.html" style="color:var(--brass);">Museum Shop</a> to add souvenirs.</p>`;
  }
  const subtotalEl = document.getElementById("cartSubtotal");
  if (subtotalEl) subtotalEl.textContent = `₱${md_cartSubtotal().toFixed(2)}`;

  // If shop.html checkout summary is present, refresh it too
  if (typeof md_renderCheckoutSummary === "function") md_renderCheckoutSummary();
}

function md_openCart() {
  document.getElementById("cart-drawer")?.classList.add("open");
  document.getElementById("overlay")?.classList.add("open");
}
function md_closeCart() {
  document.getElementById("cart-drawer")?.classList.remove("open");
  document.getElementById("overlay")?.classList.remove("open");
}
function md_toggleCart() {
  document.getElementById("cart-drawer")?.classList.contains("open") ? md_closeCart() : md_openCart();
}

function md_toast(text) {
  const el = document.createElement("div");
  el.className = "toast";
  el.textContent = text;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3200);
}
