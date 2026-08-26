/* =========================================================
   Auth helpers — used by login.html, admin.html, layout.js
   ========================================================= */

async function md_getSession() {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

async function md_getProfile() {
  const session = await md_getSession();
  if (!session) return null;
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", session.user.id)
    .single();
  if (error) {
    console.error("profile fetch error", error);
    return null;
  }
  return data;
}

/** At least 8 chars, 1 uppercase, 1 lowercase, 1 number, 1 special character */
const MD_PASSWORD_PATTERN = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;
const MD_PASSWORD_HINT =
  "Password must be at least 8 characters and include an uppercase letter, a lowercase letter, a number, and a special character (e.g. ! @ # $ %).";

function md_validatePassword(password) {
  return MD_PASSWORD_PATTERN.test(password || "");
}

/** Builds an absolute URL to confirmed.html next to whatever page this script is loaded from */
function md_getEmailRedirectUrl() {
  return new URL("confirmed.html", window.location.href).toString();
}

async function md_signUp({ fullName, email, phone, password }) {
  if (!md_validatePassword(password)) {
    return { error: { message: MD_PASSWORD_HINT } };
  }
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName },
      emailRedirectTo: md_getEmailRedirectUrl(),
    },
  });
  if (error) return { error };
  // phone stored separately since auth.users doesn't have it by default
  if (data.user) {
    await supabase.from("profiles").update({ phone }).eq("id", data.user.id);
  }
  return { data };
}

async function md_signIn({ email, password }) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  return { data, error };
}

async function md_signOut() {
  await supabase.auth.signOut();
  window.location.href = "index.html";
}

/** Guard a page: redirect to login.html if not authenticated (and optionally require admin) */
async function md_requireAuth({ adminOnly = false, redirectTo = "login.html" } = {}) {
  const session = await md_getSession();
  if (!session) {
    window.location.href = redirectTo;
    return null;
  }
  const profile = await md_getProfile();
  if (adminOnly && (!profile || profile.role !== "admin")) {
    window.location.href = "index.html";
    return null;
  }
  return profile;
}
