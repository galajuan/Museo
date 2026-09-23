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

  md_renderEvents(data || []);
  md_subscribeEventsRealtime();
}

function md_renderEvents(events) {
  const wrap = document.getElementById("eventsStrip");
  if (!wrap) return;

  if (!events || events.length === 0) {
    wrap.innerHTML = `<p class="empty-note">No upcoming events posted yet — check back soon, or ask the Docent about ongoing exhibits.</p>`;
    return;
  }

  wrap.innerHTML = events
    .map(
      (ev) => `
    <div class="event-card">
      <div class="event-media">${ev.image_url ? md_zoomableImg(ev.image_url, ev.title) : `<span>${MD_MUSEUM_LABEL[ev.museum_id] || "MuseoDavao"}</span>`}</div>
      <div class="event-body">
        <div class="event-date">${md_formatDate(ev.event_date)}${ev.event_time ? " · " + ev.event_time : ""}</div>
        <h4>${ev.title}</h4>
        <p>${ev.description || ""}</p>
      </div>
    </div>`
    )
    .join("");
}

/* Any add/edit/delete to an event from the Admin dashboard shows up here
   immediately, without the visitor needing to refresh the page. Simplest
   and safest approach is to just refetch the upcoming-events list on any
   change, rather than patch a local cache — event edits are infrequent
   and the list is small, so there's no real cost to it, and it avoids
   getting the "is this still upcoming" date logic out of sync. */
let MD_EVENTS_REALTIME_CHANNEL = null;
function md_subscribeEventsRealtime() {
  if (MD_EVENTS_REALTIME_CHANNEL || typeof supabase === "undefined" || (typeof CONFIG_OK !== "undefined" && !CONFIG_OK)) return;
  MD_EVENTS_REALTIME_CHANNEL = supabase
    .channel("events-live")
    .on("postgres_changes", { event: "*", schema: "public", table: "events" }, () => {
      md_loadEvents();
    })
    .subscribe();
}

document.addEventListener("DOMContentLoaded", md_loadEvents);
