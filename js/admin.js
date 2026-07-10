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

  md_loadAdminProducts();
  md_loadAdminEvents();
  md_loadAdminOrders();
}

/* ---------------- PRODUCTS ---------------- */
async function md_loadAdminProducts() {
  const tbody = document.getElementById("productsTableBody");
  const { data, error } = await supabase.from("products").select("*").order("created_at", { ascending: false });
  if (error) {
    tbody.innerHTML = `<tr><td colspan="6">Error loading products.</td></tr>`;
    return;
  }
  tbody.innerHTML = data
    .map(
      (p) => `
    <tr>
      <td>${p.name}</td>
      <td>${MD_MUSEUM_LABEL[p.museum_id] || "—"}</td>
      <td>₱${Number(p.price).toFixed(2)}</td>
      <td>${p.stock}</td>
      <td>${p.is_active ? "Active" : "Hidden"}</td>
      <td>
        <button class="btn-sm-outline" onclick='md_editProduct(${JSON.stringify(p)})'>Edit</button>
        <button class="btn-sm-outline" onclick="md_deleteProduct('${p.id}')">Remove</button>
      </td>
    </tr>`
    )
    .join("");
}

function md_editProduct(p) {
  MD_EDITING_PRODUCT_ID = p.id;
  document.getElementById("productFormTitle").textContent = "Edit product";
  document.getElementById("pName").value = p.name;
  document.getElementById("pMuseum").value = p.museum_id || "";
  document.getElementById("pPrice").value = p.price;
  document.getElementById("pStock").value = p.stock;
  document.getElementById("pImage").value = p.image_url || "";
  document.getElementById("pDesc").value = p.description || "";
  document.getElementById("pActive").checked = p.is_active;
  window.scrollTo({ top: document.getElementById("productForm").offsetTop - 100, behavior: "smooth" });
}

function md_resetProductForm() {
  MD_EDITING_PRODUCT_ID = null;
  document.getElementById("productForm").reset();
  document.getElementById("productFormTitle").textContent = "Add a product";
}

async function md_saveProduct(e) {
  e.preventDefault();
  const payload = {
    name: document.getElementById("pName").value.trim(),
    museum_id: document.getElementById("pMuseum").value || null,
    price: parseFloat(document.getElementById("pPrice").value),
    stock: parseInt(document.getElementById("pStock").value, 10),
    image_url: document.getElementById("pImage").value.trim(),
    description: document.getElementById("pDesc").value.trim(),
    is_active: document.getElementById("pActive").checked,
    updated_at: new Date().toISOString(),
  };

  let error;
  if (MD_EDITING_PRODUCT_ID) {
    ({ error } = await supabase.from("products").update(payload).eq("id", MD_EDITING_PRODUCT_ID));
  } else {
    ({ error } = await supabase.from("products").insert(payload));
  }

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

function md_editEvent(ev) {
  MD_EDITING_EVENT_ID = ev.id;
  document.getElementById("eventFormTitle").textContent = "Edit event";
  document.getElementById("eTitle").value = ev.title;
  document.getElementById("eMuseum").value = ev.museum_id || "";
  document.getElementById("eDate").value = ev.event_date;
  document.getElementById("eTime").value = ev.event_time || "";
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
  const payload = {
    title: document.getElementById("eTitle").value.trim(),
    museum_id: document.getElementById("eMuseum").value || null,
    event_date: document.getElementById("eDate").value,
    event_time: document.getElementById("eTime").value.trim(),
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
async function md_loadAdminOrders() {
  const tbody = document.getElementById("ordersTableBody");
  const { data, error } = await supabase.from("orders").select("*").order("created_at", { ascending: false });
  if (error) {
    tbody.innerHTML = `<tr><td colspan="7">Error loading orders.</td></tr>`;
    return;
  }
  const statuses = ["pending", "paid", "preparing", "ready", "completed", "cancelled"];
  tbody.innerHTML = data
    .map(
      (o) => `
    <tr>
      <td>${o.order_no}</td>
      <td>${o.guest_name}<br><span style="opacity:.6;font-size:.78rem;">${o.guest_email}</span></td>
      <td>${o.fulfillment === "online" ? "Delivery" : "Pickup"}</td>
      <td>${o.payment_method.toUpperCase()}${o.payment_reference ? `<br><span style="opacity:.6;font-size:.78rem;">Ref: ${o.payment_reference}</span>` : ""}</td>
      <td>₱${Number(o.total).toFixed(2)}</td>
      <td>
        <select onchange="md_updateOrderStatus('${o.id}', this.value)">
          ${statuses.map((s) => `<option value="${s}" ${s === o.status ? "selected" : ""}>${s}</option>`).join("")}
        </select>
      </td>
      <td><a href="receipt.html?order_no=${o.order_no}" target="_blank" class="btn-sm-outline" style="text-decoration:none;">Receipt</a></td>
    </tr>`
    )
    .join("");
}

async function md_updateOrderStatus(id, status) {
  const { error } = await supabase.from("orders").update({ status }).eq("id", id);
  if (error) alert("Couldn't update status: " + error.message);
}

document.addEventListener("DOMContentLoaded", md_initAdmin);
