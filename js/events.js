/* =========================================================
   Events — homepage "Current Exhibits" strip
   ========================================================= */
const MD_MUSEUM_LABEL = {
  dabawenyo: "Museo Dabawenyo",
  dbone: "D'Bone Collection",
  national: "National Museum",
};

function md_formatDate(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });
}

async function md_loadEvents() {
  const wrap = document.getElementById("eventsStrip");
  if (!wrap) return;

  if (typeof CONFIG_OK !== "undefined" && !CONFIG_OK) {
    wrap.innerHTML = `<p class="empty-note">Connect Supabase to show live events here. See README.md.</p>`;
    return;
  }

  const { data, error } = await supabase
    .from("events")
    .select("*")
    .gte("event_date", new Date().toISOString().slice(0, 10))
    .order("event_date", { ascending: true })
    .limit(6);

  if (error) {
    console.error(error);
    wrap.innerHTML = `<p class="empty-note">Couldn't load events right now.</p>`;
    return;
  }

  if (!data || data.length === 0) {
    wrap.innerHTML = `<p class="empty-note">No upcoming events posted yet — check back soon, or ask the Docent about ongoing exhibits.</p>`;
    return;
  }

  wrap.innerHTML = data
    .map(
      (ev) => `
    <div class="event-card">
      <div class="event-media">${ev.image_url ? `<img src="${ev.image_url}" alt="${ev.title}">` : `<span>${MD_MUSEUM_LABEL[ev.museum_id] || "MuseoDavao"}</span>`}</div>
      <div class="event-body">
        <div class="event-date">${md_formatDate(ev.event_date)}${ev.event_time ? " · " + ev.event_time : ""}</div>
        <h4>${ev.title}</h4>
        <p>${ev.description || ""}</p>
      </div>
    </div>`
    )
    .join("");
}

document.addEventListener("DOMContentLoaded", md_loadEvents);
