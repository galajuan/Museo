/* =========================================================
   Receipt — receipt.html
   Reads the last placed order from localStorage (set by shop.js)
   or, if ?order_no=... is present, looks it up in Supabase
   (used by account.html "view receipt" links).
   ========================================================= */

function md_renderReceipt(order, items) {
  const el = document.getElementById("receiptRoot");
  if (!el) return;

  const dateStr = new Date(order.created_at || Date.now()).toLocaleString("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  el.innerHTML = `
    <div class="receipt-card" id="printableReceipt">
      <div class="receipt-top">
        <div>
          <div class="eyebrow">Official Receipt</div>
          <h2 style="margin:6px 0 0;">MuseoDavao</h2>
        </div>
        <div class="receipt-no">
          <div class="eyebrow">Order No.</div>
          <div class="mono-lg">${order.order_no}</div>
        </div>
      </div>

      <div class="receipt-meta">
        <div><span class="eyebrow">Date</span><div>${dateStr}</div></div>
        <div><span class="eyebrow">Customer</span><div>${order.guest_name}</div></div>
        <div><span class="eyebrow">Fulfillment</span><div>${order.fulfillment === "online" ? "Delivery" : "Walk-in Pickup"}</div></div>
        <div><span class="eyebrow">Payment Method</span><div>${(order.payment_method || "").toUpperCase()}</div></div>
      </div>

      ${order.fulfillment === "online" ? `<div class="receipt-line"><span class="eyebrow">Delivery Address</span><div>${order.delivery_address || ""}</div></div>` : ""}
      ${order.payment_reference ? `<div class="receipt-line"><span class="eyebrow">Payment Reference</span><div>${order.payment_reference}</div></div>` : ""}

      <table class="receipt-table">
        <thead><tr><th>Item</th><th>Qty</th><th>Price</th><th style="text-align:right;">Total</th></tr></thead>
        <tbody>
          ${items
            .map(
              (i) => `<tr><td>${i.name}</td><td>${i.qty}</td><td>₱${i.price.toFixed(2)}</td><td style="text-align:right;">₱${(i.price * i.qty).toFixed(2)}</td></tr>`
            )
            .join("")}
        </tbody>
      </table>

      <div class="receipt-total-row">
        <span>Total Paid</span>
        <span>₱${Number(order.total).toFixed(2)}</span>
      </div>

      <div class="receipt-status">
        Status: <span class="status-pill status-${order.status}">${order.status}</span>
      </div>

      <p class="receipt-footnote">Thank you for supporting Davao City's museums. Present this receipt (digital or printed)
      ${order.fulfillment === "physical" ? "when you pick up your order." : "if delivery confirmation is needed."}</p>
    </div>`;
}

function md_printReceipt() {
  window.print();
}

function md_downloadReceipt() {
  const node = document.getElementById("printableReceipt");
  if (!node || !window.html2pdf) {
    window.print();
    return;
  }
  const orderNo = document.querySelector(".mono-lg")?.textContent || "receipt";
  html2pdf(node, {
    margin: 10,
    filename: `MuseoDavao-Receipt-${orderNo}.pdf`,
    html2canvas: { scale: 2 },
    jsPDF: { unit: "mm", format: "a5", orientation: "portrait" },
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  document.getElementById("downloadBtn")?.addEventListener("click", md_downloadReceipt);
  document.getElementById("printBtn")?.addEventListener("click", md_printReceipt);

  const params = new URLSearchParams(window.location.search);
  const orderNo = params.get("order_no");

  if (orderNo && typeof supabase !== "undefined") {
    const { data: order } = await supabase.from("orders").select("*").eq("order_no", orderNo).single();
    const { data: items } = await supabase.from("order_items").select("*").eq("order_id", order?.id);
    if (order) {
      md_renderReceipt(
        order,
        (items || []).map((i) => ({ name: i.product_name, price: i.unit_price, qty: i.quantity }))
      );
      return;
    }
  }

  const saved = JSON.parse(localStorage.getItem("museodavao_last_order") || "null");
  if (saved) {
    md_renderReceipt(saved.order, saved.items);
  } else {
    document.getElementById("receiptRoot").innerHTML = `<p class="empty-note">No recent order found. <a href="shop.html" style="color:var(--brass);">Visit the shop</a> to place one.</p>`;
  }
});
