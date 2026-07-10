/* =========================================================
   Supabase client setup
   ---------------------------------------------------------
   1. Create a free project at https://supabase.com
   2. Run supabase/schema.sql in the SQL editor (see README.md)
   3. Paste your Project URL + anon public key below
   ========================================================= */
const SUPABASE_URL ="https://tigvycsoqapdfvyopxdh.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_qoLGU7RlaS-trnfOMcZryg_8uNf7bJN";

// supabase-js is loaded via CDN <script> tag in each HTML page before this file
window.supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const CONFIG_OK = SUPABASE_URL.startsWith("http") && SUPABASE_ANON_KEY.length > 20;

if (!CONFIG_OK) {
  console.warn(
    "[MuseoDavao] Supabase is not configured yet. Open js/supabase-client.js and add your Project URL + anon key."
  );
}

/** Small helper so pages can show a friendly banner if Supabase isn't set up */
function warnIfNotConfigured(containerSelector) {
  if (CONFIG_OK) return false;
  const el = document.querySelector(containerSelector);
  if (el) {
    const div = document.createElement("div");
    div.style.cssText =
      "background:#7A3B2E;color:#F7F4EC;padding:12px 20px;font-family:'IBM Plex Mono',monospace;font-size:.78rem;text-align:center;";
    div.textContent =
      "⚠ Supabase not connected yet — add your Project URL & anon key in js/supabase-client.js";
    el.prepend(div);
  }
  return true;
}
