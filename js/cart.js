/* =========================================================
   Cart — persisted in localStorage so it survives across pages
   Cart item shape: { id, name, price, image_url, qty, museum_id, size, color }
   ========================================================= */
const MD_CART_KEY = "museodavao_cart_v1";

/** Builds the "Name (Size M, Black)" style label used in the cart drawer,
    checkout summary, order records, and receipts — kept in one place so
    they always stay in sync. */
function md_cartItemLabel(i) {
  const details = [];
  if (i.size) details.push(`Size ${i.size}`);
  if (i.color) details.push(i.color);
  return details.length ? `${i.name} (${details.join(", ")})` : i.name;
}

/* Products flagged "has_sizes" in the admin dashboard (e.g. T-shirts) sell
   in sizes, each with its own stock count. Falls back to the old
   name-matching guess for products saved before that flag existed. */
function md_needsSize(product) {
  if (!product) return false;
  if (typeof product.has_sizes === "boolean") return product.has_sizes;
  return product.museum_id === "national" && /shirt/i.test(product.name || "");
}

/** How many units of this product (in this size, if sized) are left. */
function md_stockFor(product, size = null) {
  if (!product) return 0;
  if (md_needsSize(product) && product.size_stock && size) {
    return Number(product.size_stock[size]) || 0;
  }
  return Number(product.stock) || 0;
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

function md_addToCart(product, qty = 1, size = null, color = null) {
  const cart = md_getCart();
  const existing = cart.find((i) => i.id === product.id && (i.size || null) === (size || null) && (i.color || null) === (color || null));
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
      color: color || null,
    });
  }
  md_saveCart(cart);
  const qtyLabel = qty > 1 ? ` (×${qty})` : "";
  const details = [size ? `Size ${size}` : null, color].filter(Boolean).join(", ");
  md_toast(details ? `Added "${product.name}" (${details})${qtyLabel} to your basket` : `Added "${product.name}"${qtyLabel} to your basket`);
  md_openCart();
}

/* Used by product cards that render size and/or color <select>s and/or a
   quantity stepper — reads the chosen size/color/qty (if present) before
   adding to the basket. */
function md_addToCartFromCard(product, sizeSelectId, qtyInputId, colorSelectId) {
  let size = null;
  if (sizeSelectId) {
    const sel = document.getElementById(sizeSelectId);
    if (sel && sel.value) size = sel.value;
  }
  let color = null;
  if (colorSelectId) {
    const sel = document.getElementById(colorSelectId);
    if (sel && sel.value) color = sel.value;
  }
  if (md_needsSize(product) && !size) {
    md_toast("Please choose a size first");
    return;
  }
  const maxStock = Math.max(0, md_stockFor(product, size));
  if (maxStock <= 0) {
    md_toast(size ? `Size ${size} just sold out` : "That item just sold out");
    md_renderProducts && md_renderProducts();
    return;
  }
  let qty = 1;
  if (qtyInputId) {
    const input = document.getElementById(qtyInputId);
    if (input) qty = parseInt(input.value, 10) || 1;
  }
  qty = Math.min(Math.max(1, qty), maxStock);
  md_addToCart(product, qty, size, color);
}

function md_updateQty(id, delta, size = null, color = null) {
  const cart = md_getCart();
  const item = cart.find((i) => i.id === id && (i.size || null) === (size || null) && (i.color || null) === (color || null));
  if (!item) return;
  if (delta > 0 && typeof MD_PRODUCTS_CACHE !== "undefined") {
    const product = MD_PRODUCTS_CACHE.find((p) => p.id === id);
    if (product) {
      const max = md_stockFor(product, size);
      if (item.qty >= max) {
        md_toast(`Only ${max} left${size ? ` in size ${size}` : ""}`);
        return;
      }
    }
  }
  item.qty += delta;
  const filtered = item.qty <= 0 ? cart.filter((i) => i !== item) : cart;
  md_saveCart(filtered);
}

function md_removeFromCart(id, size = null, color = null) {
  md_saveCart(md_getCart().filter((i) => !(i.id === id && (i.size || null) === (size || null) && (i.color || null) === (color || null))));
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
            i.image_url ? md_zoomableImg(i.image_url, i.name) : ""
          }</div>
          <div class="cinfo">
            <h6>${i.name}${
              i.size || i.color
                ? ` <span style="opacity:.6;font-weight:400;">— ${[i.size ? `Size ${i.size}` : null, i.color].filter(Boolean).join(", ")}</span>`
                : ""
            }</h6>
            <div class="qty-ctl">
              <button onclick="md_updateQty('${i.id}',-1,${i.size ? `'${i.size}'` : "null"},${i.color ? `'${i.color}'` : "null"})">−</button>
              <span>${i.qty}</span>
              <button onclick="md_updateQty('${i.id}',1,${i.size ? `'${i.size}'` : "null"},${i.color ? `'${i.color}'` : "null"})">+</button>
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
