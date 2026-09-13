/* =========================================================
   Shared product card renderer.
   Used by shop.html AND every museum-specific wing page
   (national-museum.html, dbone-collection.html, museo-dabawenyo.html)
   so there's exactly one place that knows how to show size/color/stock.

   Previously each wing page had its own hand-written copy of this card
   that only knew about the flat `stock` total, not per-size stock — so
   switching the Size dropdown never changed the "in stock" count shown.
   Loading this one file everywhere fixes that, and stops it from
   happening again the next time stock display logic needs a tweak.
   ========================================================= */

let MD_PRODUCTS_CACHE = [];
let MD_ACTIVE_SIZE = "all";

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

  // For sized items, the "current" size defaults to: the active Size
  // filter (if the shopper filtered to e.g. "Large" and this product has
  // it in stock), else whatever the shopper already had selected, else
  // the first size that still has stock.
  const prevSel = document.getElementById(sizeId)?.value;
  const defaultSize =
    MD_ACTIVE_SIZE !== "all" && (Number(sizeStock[MD_ACTIVE_SIZE]) || 0) > 0
      ? MD_ACTIVE_SIZE
      : prevSel && sizeStock[prevSel] > 0
      ? prevSel
      : MD_SIZE_ORDER.find((s) => (Number(sizeStock[s]) || 0) > 0) || MD_SIZE_ORDER[0];
  const stockForSelectedSize = showSize ? Number(sizeStock[defaultSize]) || 0 : totalStock;

  // Same idea for color — keep whatever the shopper had picked if it's
  // still a valid option for this product.
  const prevColorSel = document.getElementById(colorId)?.value;
  const defaultColor = prevColorSel && colorOptions.includes(prevColorSel) ? prevColorSel : colorOptions[0];

  const stockNoteClass = stockForSelectedSize <= 0 ? "out" : stockForSelectedSize <= 5 ? "low" : "";
  const stockNoteText = isCollection
    ? "Collection item"
    : stockForSelectedSize > 0
    ? showSize
      ? `${stockForSelectedSize} in stock (size ${defaultSize})`
      : `${stockForSelectedSize} in stock`
    : showSize
    ? `Size ${defaultSize} sold out`
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
        <h4>${md_escapeHtml(p.name)}</h4>
        <p class="product-desc">${md_escapeHtml(p.description || "")}</p>
        ${
          showColor
            ? `<div class="size-field"><label for="${colorId}">Color</label>
                <select id="${colorId}" class="size-select" onchange="md_onSizeChange('${p.id}')">
                  ${colorSelectOptions}
                </select></div>`
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
                </div></div>`
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
            : `<button class="btn-sm js-add-to-cart" data-product-id="${p.id}" style="width:100%;margin-top:6px;" ${disableAdd ? "disabled" : ""}>
          ${disableAdd ? "Out of stock" : "Add to basket"}
        </button>`
        }
      </div>
    </div>`;
}

/** Re-render just the one card when the shopper switches size/color, so
    the quantity max / hint / button update to match that size's stock. */
function md_onSizeChange(productId) {
  const p = MD_PRODUCTS_CACHE.find((pr) => String(pr.id) === String(productId));
  if (!p) return;
  const card = document.querySelector(`.product-card[data-product-id="${productId}"]`);
  if (!card) return;
  card.outerHTML = md_productCardHtml(p);
}

/* Delegated so it survives every grid re-render, and so a product name or
   description containing an apostrophe or quote can never break the
   button (embedding a whole product as JSON inside an onclick='...'
   attribute breaks — and corrupts the rest of the grid's HTML — the
   moment any product has an apostrophe in its name or description).
   The button only ever carries a plain id in a data attribute. */
function md_initGridDelegation(gridId) {
  const grid = document.getElementById(gridId);
  if (!grid) return;
  grid.addEventListener("click", (e) => {
    const btn = e.target.closest(".js-add-to-cart");
    if (!btn) return;
    const product = MD_PRODUCTS_CACHE.find((p) => String(p.id) === btn.dataset.productId);
    if (!product) return;
    const sizeSelectId = `size-${product.id}`;
    const colorSelectId = `color-${product.id}`;
    const qtyInputId = `qty-${product.id}`;
    md_addToCartFromCard(
      product,
      document.getElementById(sizeSelectId) ? sizeSelectId : null,
      document.getElementById(qtyInputId) ? qtyInputId : null,
      document.getElementById(colorSelectId) ? colorSelectId : null
    );
  });
}
