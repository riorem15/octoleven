// Configuration for Supabase Backend
export const supabaseConfig = {
  url: "https://gxxcjosadapmsjwmmdnk.supabase.co",
  anonKey: "sb_publishable_ZiJ62aeNSnZHI5_CKOdoBw_gxbVdp5g"
};

export const isSupabaseConfigured = Object.values(supabaseConfig).every(
  (val) => val && !val.startsWith("REPLACE_WITH_")
);
