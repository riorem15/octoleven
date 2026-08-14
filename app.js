/* ==========================================================================
   Octoleven - Couple PAP & Android Widget Engine (Supabase Real-Time Backend)
   ========================================================================== */

// --- Preset Photos for Simulation / Offline Mode ---
const SAMPLE_PRESET_PHOTOS = [
  'https://images.unsplash.com/photo-1517256064527-09c73fc73e38?w=800&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1516589178581-6cd7833ae3b2?w=800&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1522673607200-164d1b6ce486?w=800&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=800&auto=format&fit=crop&q=80'
];

// --- App State ---
let coupleData = {
  id: 'couple-1',
  users: {}, // Dynamic profiles
  inviteCode: 'OCTO-7K92',
  isPaired: false,
  relationshipStartDate: new Date().toISOString()
};
let moments = [];
let currentTab = 'home';
let currentFilter = 'all';
let selectedSticker = 'Cafe ☕';
let currentCapturedImage = null;
let currentMediaFile = null;
let mediaStream = null;
let currentFacingMode = 'user';
let widgetSize = 'landscape';
let currentUser = null; // Logged in Supabase User
let supabaseAuthInitialized = false;
let supabaseRealtimeChannel = null;

function isSupabaseReady() {
  return Boolean(window.supabaseTools?.configured && window.supabaseTools?.client);
}

function getSupabase() {
  return window.supabaseTools?.client;
}

function makeInviteCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'OCTO-';
  for (let i = 0; i < 4; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

// Convert Base64 Data URL to Blob for Supabase Storage
function dataURItoBlob(dataURI) {
  const byteString = atob(dataURI.split(',')[1]);
  const mimeString = dataURI.split(',')[0].split(':')[1].split(';')[0];
  const ab = new ArrayBuffer(byteString.length);
  const ia = new Uint8Array(ab);
  for (let i = 0; i < byteString.length; i++) {
    ia[i] = byteString.charCodeAt(i);
  }
  return new Blob([ab], { type: mimeString });
}

// --- Supabase Workspace Hydration ---
async function hydrateWorkspace(workspaceId) {
  const supabase = getSupabase();
  if (!supabase) return;

  // 1. Fetch Couple Info
  const { data: couple, error: coupleErr } = await supabase
    .from('couples')
    .select('*')
    .eq('id', workspaceId)
    .single();

  if (coupleErr || !couple) {
    throw new Error('Ruang pasangan tidak ditemukan.');
  }

  coupleData.id = workspaceId;
  coupleData.inviteCode = couple.invite_code || makeInviteCode();
  coupleData.relationshipStartDate = couple.relationship_start_date || new Date().toISOString();
  coupleData.activeUser = currentUser.id;

  // 2. Fetch Members
  const { data: members, error: membersErr } = await supabase
    .from('members')
    .select('*')
    .eq('couple_id', workspaceId);

  coupleData.users = {};
  if (members && members.length > 0) {
    members.forEach((m) => {
      coupleData.users[m.id] = {
        id: m.id,
        name: m.name,
        avatar: m.avatar || '',
        moodEmoji: m.mood_emoji || '🥰',
        moodText: m.mood_text || 'Lagi mikirin kamu!',
        nextDateLabel: m.next_date_label || '',
        nextDateTime: m.next_date_time || ''
      };
    });
  }

  coupleData.isPaired = Object.keys(coupleData.users).length > 1;

  // Upsert current member profile
  const userName = currentUser.user_metadata?.full_name || currentUser.email?.split('@')[0] || 'Pengguna';
  const userAvatar = currentUser.user_metadata?.avatar_url || '';

  const currentMember = coupleData.users[currentUser.id] || {
    id: currentUser.id,
    name: userName,
    avatar: userAvatar,
    moodEmoji: '🥰',
    moodText: 'Lagi mikirin kamu!'
  };
  
  // Force update the name to fix any typos stored in DB
  if (currentMember.name !== userName) {
    currentMember.name = userName;
  }

  coupleData.users[currentUser.id] = currentMember;

  await supabase.from('members').upsert({
    id: currentUser.id,
    couple_id: workspaceId,
    name: currentMember.name,
    avatar: currentMember.avatar,
    mood_emoji: currentMember.moodEmoji,
    mood_text: currentMember.moodText,
    updated_at: new Date().toISOString()
  });

  saveData();
}

async function ensureWorkspaceForUser(user) {
  const supabase = getSupabase();
  if (!supabase) return;

  let workspaceId = 'couple-rio-nindya';

  const { data: couple } = await supabase
    .from('couples')
    .select('id')
    .eq('id', workspaceId)
    .maybeSingle();

  if (!couple) {
    const inviteCode = makeInviteCode();
    await supabase.from('couples').insert({
      id: workspaceId,
      invite_code: inviteCode,
      relationship_start_date: new Date().toISOString(),
      created_by: user.id
    });

    await supabase.from('pair_codes').insert({
      code: inviteCode,
      couple_id: workspaceId,
      owner_id: user.id
    });
  }

  await hydrateWorkspace(workspaceId);
}

// --- Supabase Realtime Listener ---
async function fetchMomentsFromSupabase() {
  const supabase = getSupabase();
  if (!supabase || !coupleData.id) return;

  const { data: papsData, error } = await supabase
    .from('paps')
    .select('*')
    .eq('couple_id', coupleData.id)
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) {
    console.warn('Gagal mengambil momen Supabase:', error.message);
    return;
  }

  if (papsData) {
    // Also fetch comments and reactions if any
    const { data: reactionsData } = await supabase.from('reactions').select('*');
    const { data: commentsData } = await supabase.from('comments').select('*');

    moments = papsData.map((p) => {
      const pReactions = {};
      (reactionsData || []).filter(r => r.pap_id === p.id).forEach(r => {
        pReactions[r.emoji] = (pReactions[r.emoji] || 0) + 1;
      });
      if (!pReactions['❤️']) pReactions['❤️'] = p.like_count || 1;

      const pComments = (commentsData || []).filter(c => c.pap_id === p.id).map(c => ({
        senderId: c.user_id,
        senderName: c.user_name,
        text: c.text
      }));

      return {
        id: p.id,
        coupleId: p.couple_id,
        senderId: p.sender_id,
        senderName: p.sender_name,
        senderAvatar: p.sender_avatar,
        image: p.photo_url,
        caption: p.caption,
        sticker: p.sticker,
        timestamp: p.created_at,
        reactions: pReactions,
        comments: pComments
      };
    });

    saveData();
    renderHomeView();
    renderFeed(currentFilter);
    updateSimulatedWidget();
  }
}

function initSupabaseRealtime() {
  const supabase = getSupabase();
  if (!supabase || !coupleData.id) return;

  if (supabaseRealtimeChannel) {
    supabase.removeChannel(supabaseRealtimeChannel);
  }

  supabaseRealtimeChannel = supabase.channel(`couple_${coupleData.id}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'paps', filter: `couple_id=eq.${coupleData.id}` }, () => {
      fetchMomentsFromSupabase();
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'members', filter: `couple_id=eq.${coupleData.id}` }, () => {
      hydrateWorkspace(coupleData.id).then(() => {
        updateUIForActiveUser();
        renderHomeView();
      });
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'reactions' }, () => {
      fetchMomentsFromSupabase();
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'comments' }, () => {
      fetchMomentsFromSupabase();
    })
    .on('broadcast', { event: 'love_poke' }, (payload) => {
      if (payload.payload.senderId !== currentUser.id) {
        showToast(`${payload.payload.senderName} lagi kangen kamu! 🥺`, 'favorite');
        playSound('heart');
        vibrate([50, 100, 50, 100, 50]);
        spawnFloatingEmoji('❤️', window.innerWidth / 2, 100);
        
        // Coba trigger Local Notification jika app terbuka/di background sementara
        if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.LocalNotifications) {
            window.Capacitor.Plugins.LocalNotifications.schedule({
                notifications: [{
                    title: 'Panggilan Rindu! 🥺',
                    body: `${payload.payload.senderName} lagi kangen banget sama kamu!`,
                    id: Math.floor(Math.random() * 100000),
                    schedule: { at: new Date(Date.now() + 1000) }
                }]
            });
        }
      }
    })
    .subscribe();

  fetchMomentsFromSupabase();
}

async function handleAuthSession(session) {
  if (!session || !session.user) return;
  currentUser = session.user;
  
  const loginScreen = document.getElementById('loginScreen');
  const mainApp = document.getElementById('mainAppContent');

  try {
    if (loginScreen) {
      loginScreen.classList.add('hidden');
      loginScreen.classList.remove('flex');
    }
    if (mainApp) {
      mainApp.classList.remove('hidden');
      mainApp.classList.add('flex');
    }

    await ensureWorkspaceForUser(currentUser);
    initSupabaseRealtime();
    
    // --- Initialize Push Notifications ---
    if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.PushNotifications) {
      const PushNotifications = window.Capacitor.Plugins.PushNotifications;
      
      let permStatus = await PushNotifications.checkPermissions();
      if (permStatus.receive === 'prompt') {
        permStatus = await PushNotifications.requestPermissions();
      }
      
      if (permStatus.receive === 'granted') {
        PushNotifications.register();
        
        PushNotifications.addListener('registration', (token) => {
          console.log('Push registration success, token: ' + token.value);
          // Here you would save the token to Supabase for this user
          const supabase = getSupabase();
          if (supabase && currentUser) {
            supabase.from('members').update({ fcm_token: token.value }).eq('id', currentUser.id);
          }
        });

        PushNotifications.addListener('registrationError', (error) => {
          console.error('Error on registration: ' + JSON.stringify(error));
        });

        PushNotifications.addListener('pushNotificationReceived', (notification) => {
          console.log('Push received: ' + JSON.stringify(notification));
          showToast(notification.title || 'Notifikasi Baru', 'notifications');
        });
      }
    }

  } catch (err) {
    console.error('Error in handleAuthSession:', err);
    showToast('Gagal memuat ruang: ' + err.message, 'error');
    
    // Revert UI on error
    if (loginScreen) {
      loginScreen.classList.remove('hidden');
      loginScreen.classList.add('flex');
    }
    if (mainApp) {
      mainApp.classList.add('hidden');
      mainApp.classList.remove('flex');
    }
  }
}

// --- Supabase Official Backend Authentication Gating ---
function initSupabaseAuth() {
  if (supabaseAuthInitialized) return;
  supabaseAuthInitialized = true;

  const loginScreen = document.getElementById('loginScreen');
  const mainApp = document.getElementById('mainAppContent');

  const savedUser = localStorage.getItem('octo_permanent_user');
  if (savedUser) {
    try {
      const user = JSON.parse(savedUser);
      currentUser = user;
      // Pretend to have a session
      handleAuthSession({ user });
      return;
    } catch(e) {}
  }

  // ALWAYS force Login Screen first by default if no user saved
  currentUser = null;
  if (loginScreen) {
    loginScreen.classList.remove('hidden');
    loginScreen.classList.add('flex');
  }
  if (mainApp) {
    mainApp.classList.add('hidden');
    mainApp.classList.remove('flex');
  }
}

let currentAuthMode = 'login';

window.switchAuthTab = function(mode) {
  currentAuthMode = mode;
  const tabLogin = document.getElementById('tabAuthLogin');
  const tabRegister = document.getElementById('tabAuthRegister');
  const nameGroup = document.getElementById('authNameGroup');
  const submitBtn = document.getElementById('authSubmitBtn');

  if (mode === 'register') {
    if (tabRegister) tabRegister.className = 'flex-1 font-label-bold text-xs py-1 text-center font-bold text-primary border-b-2 border-primary';
    if (tabLogin) tabLogin.className = 'flex-1 font-label-bold text-xs py-1 text-center text-on-surface-variant';
    if (nameGroup) nameGroup.classList.remove('hidden');
    if (submitBtn) submitBtn.innerText = 'Daftar & Masuk ke Ruang Pasangan';
  } else {
    if (tabLogin) tabLogin.className = 'flex-1 font-label-bold text-xs py-1 text-center font-bold text-primary border-b-2 border-primary';
    if (tabRegister) tabRegister.className = 'flex-1 font-label-bold text-xs py-1 text-center text-on-surface-variant';
    if (nameGroup) nameGroup.classList.add('hidden');
    if (submitBtn) submitBtn.innerText = 'Masuk ke Ruang Pasangan';
  }
};

window.handleAuthSubmit = async function() {
  const emailEl = document.getElementById('authEmailInput');
  const passEl = document.getElementById('authPasswordInput');

  const username = emailEl?.value.trim().toLowerCase();
  const password = passEl?.value.trim();

  if (!username || !password) {
    showToast('Masukkan Username dan Kata Sandi!', 'warning');
    return;
  }

  showToast('Memeriksa akun... 🚀', 'sync');

  let user = null;
  // Akun Rio
  if ((username.includes('rio') || username.includes('refki')) && password === '12345678') {
    user = { id: 'user-rio-123', email: 'rio@octoleven.local', user_metadata: { full_name: 'Rio Refki Maulana' } };
  } 
  // Akun Nindya
  else if ((username.includes('nindya') || username.includes('rachmawati') || username.includes('nindi')) && password === 'sayang rio') {
    user = { id: 'user-nindya-123', email: 'nindya@octoleven.local', user_metadata: { full_name: 'Nindya Rachmawati' } };
  }

  if (user) {
    currentUser = user;
    localStorage.setItem('octo_permanent_user', JSON.stringify(currentUser));
    showToast(`Selamat datang ${user.user_metadata.full_name}! ❤️`, 'favorite');
    
    // Simulate a fake Supabase session object so the app thinks it's logged in
    const fakeSession = { user: currentUser };
    handleAuthSession(fakeSession);
  } else {
    showToast('Username atau Kata Sandi salah!', 'error');
  }
};

window.loginWithGoogle = async function() {
  if (!isSupabaseReady()) {
    showToast('Edit supabase-config.js dengan URL & Anon Key Supabase Anda!', 'error');
    return;
  }

  showToast('Menghubungkan ke Google Auth Supabase... 🚀', 'sync');

  const supabase = getSupabase();
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: window.location.origin
    }
  });

  if (error) {
    showToast('Gagal Google Auth: ' + error.message, 'error');
  }
};

function logout() {
  // Clear local permanent session
  localStorage.removeItem('octo_permanent_user');
  currentUser = null;

  if (isSupabaseReady()) {
    const supabase = getSupabase();
    supabase.auth.signOut();
  }

  const loginScreen = document.getElementById('loginScreen');
  const mainApp = document.getElementById('mainAppContent');
  if (loginScreen) loginScreen.classList.remove('hidden');
  if (mainApp) {
    mainApp.classList.add('hidden');
    mainApp.classList.remove('flex');
  }
  showToast('Anda telah keluar.', 'logout');
}

// Listen to Supabase ready event
document.addEventListener('DOMContentLoaded', () => {
  initSupabaseAuth();
});
window.addEventListener('supabase-ready', initSupabaseAuth);

// --- Web Audio Synthesizer (Sound Effects) ---
function playSound(type) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === 'snap') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(800, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.01, ctx.currentTime + 0.15);
      osc.start();
      osc.stop(ctx.currentTime + 0.15);
    } else if (type === 'heart') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, ctx.currentTime);
      osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.08);
      osc.frequency.setValueAtTime(783.99, ctx.currentTime + 0.16);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.01, ctx.currentTime + 0.3);
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    } else if (type === 'toast') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.12);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.01, ctx.currentTime + 0.12);
      osc.start();
      osc.stop(ctx.currentTime + 0.12);
    }
  } catch (e) {}
}

// --- Haptic & Push Notification Helper ---
function vibrate(pattern = 35) {
  if ('vibrate' in navigator) {
    try {
      navigator.vibrate(pattern);
    } catch (e) {}
  }
}

function requestNotificationPermission() {
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }
}

// --- Toast Notification ---
function showToast(message, icon = 'favorite') {
  playSound('toast');
  const toast = document.getElementById('toastNotification');
  const msgEl = document.getElementById('toastMessage');
  const iconEl = document.getElementById('toastIcon');

  if (!toast) return;
  msgEl.innerText = message;
  iconEl.innerText = icon;

  toast.classList.remove('opacity-0', '-translate-y-4', 'pointer-events-none');
  toast.classList.add('opacity-100', 'translate-y-0');

  setTimeout(() => {
    toast.classList.add('opacity-0', '-translate-y-4', 'pointer-events-none');
    toast.classList.remove('opacity-100', 'translate-y-0');
  }, 2800);
}

// --- Persistence ---
function saveData() {
  localStorage.setItem('octo_couple_data', JSON.stringify(coupleData));
  localStorage.setItem('octo_moments', JSON.stringify(moments));
}

// --- Time Formatter ---
function formatTimeAgo(isoString) {
  const date = new Date(isoString);
  const now = new Date();
  const diffInMinutes = Math.floor((now - date) / (1000 * 60));

  if (diffInMinutes < 1) return 'Baru saja';
  if (diffInMinutes < 60) return `${diffInMinutes} menit lalu`;
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `${diffInHours} jam lalu`;
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays === 1) return 'Kemarin';
  return `${diffInDays} hari lalu`;
}

function formatExactTime(isoString) {
  const date = new Date(isoString);
  return date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB';
}

function calculateDaysTogether() {
  const start = new Date(coupleData.relationshipStartDate || new Date().toISOString());
  const now = new Date();
  const diffTime = Math.abs(now - start);
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

// --- Switch Tab View ---
function switchTab(tabId) {
  currentTab = tabId;
  vibrate(20);
  requestNotificationPermission();

  document.querySelectorAll('.tab-content').forEach(tab => {
    tab.classList.add('hidden');
  });

  const activeTabEl = document.getElementById(`tab-${tabId}`);
  if (activeTabEl) {
    activeTabEl.classList.remove('hidden');
  }

  document.querySelectorAll('.nav-item').forEach(nav => {
    nav.className = 'nav-item flex flex-col items-center justify-center text-on-surface-variant hover:bg-surface-container-high rounded-xl py-1.5 px-3 active:scale-95 transition-all flex-1 mx-1';
  });

  const activeNav = document.getElementById(`nav-${tabId}`);
  if (activeNav) {
    activeNav.className = 'nav-item flex flex-col items-center justify-center bg-secondary-container text-on-secondary-container rounded-xl border-2 border-on-background py-1.5 px-3 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:scale-95 transition-all flex-1 mx-1';
  }

  if (tabId === 'feed') {
    renderFeed(currentFilter);
  } else if (tabId === 'widget') {
    updateSimulatedWidget();
  } else if (tabId === 'home') {
    renderHomeView();
  }

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// --- Update UI Labels ---
function updateUIForActiveUser() {
  const activeUser = coupleData.users[coupleData.activeUser] || {
    id: coupleData.activeUser || 'local-user',
    name: 'Pengguna',
    avatar: '',
    moodEmoji: '🥰',
    moodText: 'Lagi mikirin kamu!'
  };
  const partnerUser = Object.values(coupleData.users).find((user) => user.id !== activeUser.id);
  const partnerName = partnerUser?.name || 'Pasangan';
  const coupleTitle = partnerUser ? `${activeUser.name} & ${partnerUser.name}` : `${activeUser.name} (Menunggu Pasangan)`;

  const headerAvatar = document.getElementById('headerUserAvatar');
  const activeUserLabel = document.getElementById('activeUserLabel');
  
  const getAvatarUrl = (user) => {
    if (user && user.avatar && !user.avatar.includes('unsplash')) return user.avatar;
    return `https://api.dicebear.com/7.x/notionists/svg?seed=${user?.name || 'User'}&backgroundColor=ffdfbf`;
  };

  const finalActiveAvatar = getAvatarUrl(activeUser);
  const finalPartnerAvatar = getAvatarUrl(partnerUser);

  if (headerAvatar) headerAvatar.src = finalActiveAvatar;
  if (activeUserLabel) activeUserLabel.innerText = coupleTitle;

  const coupleAvatar1 = document.getElementById('coupleAvatar1');
  const coupleName1 = document.getElementById('coupleName1');
  const coupleAvatar2 = document.getElementById('coupleAvatar2');
  const coupleName2 = document.getElementById('coupleName2');

  if (coupleAvatar1) coupleAvatar1.src = finalActiveAvatar;
  if (coupleName1) coupleName1.innerText = `Kamu (${activeUser.name})`;
  if (coupleAvatar2) coupleAvatar2.src = finalPartnerAvatar;
  if (coupleName2) coupleName2.innerText = `Pasangan (${partnerName})`;

  const homeGreeting = document.getElementById('homeGreetingText');
  if (homeGreeting) {
    homeGreeting.innerText = `Hai ${activeUser.name}, kangen ya? ❤️`;
  }

  const daysTogetherText = document.getElementById('daysTogetherText');
  if (daysTogetherText) {
    const days = calculateDaysTogether();
    daysTogetherText.innerText = `${coupleTitle} • ${days} hari bersama`;
  }

  const heroPapStatus = document.getElementById('heroPapStatus');
  if (heroPapStatus) {
    heroPapStatus.innerText = `Lagi di mana sekarang? Kirim foto buat ${partnerName} & langsung muncul di widget HP-nya!`;
  }

  const partnerMoodEmoji = document.getElementById('partnerMoodEmoji');
  const partnerMoodText = document.getElementById('partnerMoodText');
  const partnerMoodLabel = document.getElementById('partnerMoodLabel');
  if (partnerMoodEmoji && partnerMoodText) {
    partnerMoodEmoji.innerText = partnerUser.moodEmoji || '🥰';
    partnerMoodText.innerText = `"${partnerUser.moodText || 'Belum ada status'}"`;
    if (partnerMoodLabel) partnerMoodLabel.innerText = `Status ${partnerName}`;
  }

  const statTotalPap = document.getElementById('statTotalPap');
  if (statTotalPap) statTotalPap.innerText = moments.length;

  // Update Agenda UI
  const latestAgendaUser = (activeUser.nextDateTime && partnerUser.nextDateTime) 
    ? (new Date(activeUser.nextDateTime) > new Date(partnerUser.nextDateTime) ? activeUser : partnerUser)
    : (activeUser.nextDateTime ? activeUser : partnerUser);

  if (latestAgendaUser && latestAgendaUser.nextDateTime) {
    const agendaTitleEls = document.querySelectorAll('h4.text-on-tertiary-container');
    agendaTitleEls.forEach(el => {
       if(el.innerText === 'Agenda Terdekat' || el.innerText === latestAgendaUser.nextDateLabel || el.innerText.includes('Agenda')) {
           el.innerText = latestAgendaUser.nextDateLabel;
           const dateSpan = el.nextElementSibling;
           if (dateSpan) dateSpan.innerText = new Date(latestAgendaUser.nextDateTime).toLocaleString('id-ID');
       }
    });
  }
}

// --- Render Home Recent Drops Reel ---
function renderHomeView() {
  updateUIForActiveUser();
  const reelContainer = document.getElementById('homeRecentReel');
  if (!reelContainer) return;

  if (moments.length === 0) {
    reelContainer.innerHTML = `<div class="text-xs text-on-surface-variant p-3">Belum ada PAP yang dikirim. Jadilah yang pertama mengirim!</div>`;
    return;
  }

  const recentList = moments.slice(0, 5);
  const rotations = ['rotate-[-2deg]', 'rotate-[2deg]', 'rotate-[-1deg]', 'rotate-[3deg]', 'rotate-[-3deg]'];

  reelContainer.innerHTML = recentList.map((m, idx) => {
    const rot = rotations[idx % rotations.length];
    const senderName = m.senderName || 'Pasangan';
    const heartCount = m.reactions?.['❤️'] || 0;

    return `
      <div onclick="switchTab('feed')" class="w-32 h-44 shrink-0 bg-surface neo-border-sm rounded-xl p-2 snap-center relative transform ${rot} polaroid-card cursor-pointer flex flex-col justify-between">
        <div class="w-full h-28 bg-surface-variant rounded-lg flex items-center justify-center overflow-hidden neo-border-sm">
          <img src="${m.image}" alt="PAP thumbnail" class="w-full h-full object-cover"/>
        </div>
        <div class="flex justify-between items-center mt-1">
          <span class="text-[10px] font-bold text-on-surface-variant line-clamp-1">${senderName}</span>
          <span class="text-[10px] font-bold text-primary flex items-center gap-0.5">
            ❤️ ${heartCount}
          </span>
        </div>
        <span class="absolute -bottom-2 -right-1 bg-secondary-container text-on-secondary-container font-caption text-[10px] font-bold px-2 py-0.5 rounded-full neo-border-sm shadow-sm">
          ${m.sticker || 'PAP 📸'}
        </span>
      </div>
    `;
  }).join('');
}

// --- Render Private Feed Tab ---
function renderFeed(filter = 'all') {
  currentFilter = filter;
  const feedContainer = document.getElementById('feedStream');
  if (!feedContainer) return;

  document.querySelectorAll('.feed-filter-btn').forEach(btn => {
    btn.className = 'feed-filter-btn px-3.5 py-1.5 rounded-full neo-border-sm bg-surface font-label-bold text-xs text-on-surface-variant active-press';
  });
  const activeFilterBtn = document.getElementById(`filter-${filter}`);
  if (activeFilterBtn) {
    activeFilterBtn.className = 'feed-filter-btn px-3.5 py-1.5 rounded-full neo-border-sm bg-secondary-container font-label-bold text-xs text-on-secondary-container active-press';
  }

  let filteredMoments = moments;
  if (filter !== 'all') {
    filteredMoments = moments.filter(m => m.senderId === filter || m.senderName?.toLowerCase().includes(filter));
  }

  if (filteredMoments.length === 0) {
    feedContainer.innerHTML = `
      <div class="bg-surface-container neo-border rounded-xl p-8 text-center space-y-3 neo-shadow-sm">
        <span class="text-4xl">📸</span>
        <h4 class="font-bold text-base">Belum Ada Momen PAP</h4>
        <p class="text-xs text-on-surface-variant">Kirimkan PAP pertama kamu untuk memenuhi lembaran memori privat ini!</p>
        <button onclick="openPapModal()" class="px-4 py-2 bg-primary-container text-white rounded-xl neo-border-sm text-xs font-bold neo-shadow-sm active-press">
          + Ambil PAP Sekarang
        </button>
      </div>
    `;
    return;
  }

  feedContainer.innerHTML = filteredMoments.map((moment, index) => {
    const senderName = moment.senderName || 'Pasangan';
    const cardBg = index % 2 === 0 ? 'bg-surface-container-highest' : 'bg-surface';
    const tilt = index % 3 === 1 ? '-rotate-1 hover:rotate-0' : (index % 3 === 2 ? 'rotate-1 hover:rotate-0' : '');
    const reactions = moment.reactions || { '❤️': 1, '🥹': 0, '😂': 0, '🔥': 0 };

    return `
      <article class="${cardBg} rounded-2xl neo-border neo-shadow p-4 flex flex-col gap-3 relative transition-transform duration-200 ${tilt}">
        <div class="flex justify-between items-start">
          <div class="flex items-center gap-2.5">
            <div class="w-9 h-9 rounded-full bg-primary-container text-white neo-border-sm flex items-center justify-center shrink-0 overflow-hidden font-label-bold text-sm uppercase">
              ${senderName[0]}
            </div>
            <div>
              <div class="font-label-bold text-sm text-on-background font-bold flex items-center gap-1.5">
                <span>${senderName}</span>
              </div>
              <div class="font-caption text-[11px] text-on-surface-variant">
                ${formatExactTime(moment.timestamp)} • ${formatTimeAgo(moment.timestamp)}
              </div>
            </div>
          </div>
          <span class="bg-surface-container px-2.5 py-1 rounded-full neo-border-sm font-label-bold text-[11px] text-primary font-bold">
            ${moment.sticker || 'PAP ✨'}
          </span>
        </div>

        <div class="w-full rounded-xl neo-border overflow-hidden bg-surface-dim relative group aspect-[4/3]">
          <img src="${moment.image}" alt="PAP Photo" class="w-full h-full object-cover"/>
        </div>

        <p class="font-body-md text-sm text-on-background leading-relaxed font-medium">
          ${moment.caption}
        </p>

        <div class="flex items-center gap-2 flex-wrap pt-1 border-t border-outline-variant/40">
          <button onclick="handleFeedReaction('${moment.id}', '❤️', event)" class="bg-surface rounded-full px-3 py-1 neo-border-sm neo-shadow-sm active-press flex items-center gap-1 font-label-bold text-xs hover:bg-primary-fixed-dim">
            <span>❤️</span> <span class="font-bold">${reactions['❤️'] || 0}</span>
          </button>
          <button onclick="handleFeedReaction('${moment.id}', '🥹', event)" class="bg-surface rounded-full px-3 py-1 neo-border-sm neo-shadow-sm active-press flex items-center gap-1 font-label-bold text-xs hover:bg-secondary-fixed">
            <span>🥹</span> <span class="font-bold">${reactions['🥹'] || 0}</span>
          </button>
          <button onclick="handleFeedReaction('${moment.id}', '😂', event)" class="bg-surface rounded-full px-3 py-1 neo-border-sm neo-shadow-sm active-press flex items-center gap-1 font-label-bold text-xs hover:bg-tertiary-fixed">
            <span>😂</span> <span class="font-bold">${reactions['😂'] || 0}</span>
          </button>
          <button onclick="handleFeedReaction('${moment.id}', '🔥', event)" class="bg-surface rounded-full px-3 py-1 neo-border-sm neo-shadow-sm active-press flex items-center gap-1 font-label-bold text-xs hover:bg-primary-fixed-dim">
            <span>🔥</span> <span class="font-bold">${reactions['🔥'] || 0}</span>
          </button>
        </div>

        ${moment.comments && moment.comments.length > 0 ? `
          <div class="bg-surface/80 rounded-xl p-2.5 neo-border-sm space-y-1.5 mt-1">
            ${moment.comments.map(c => `
              <div class="text-xs">
                <span class="font-bold text-primary">${c.senderName}:</span>
                <span class="text-on-background">${c.text}</span>
              </div>
            `).join('')}
          </div>
        ` : ''}

        <div class="flex gap-2 items-center mt-1">
          <input type="text" id="replyInput-${moment.id}" placeholder="Kirim bisikan ke pacar..." class="flex-1 bg-surface rounded-lg px-2.5 py-1.5 text-xs neo-input" onkeydown="if(event.key==='Enter') submitFeedComment('${moment.id}')"/>
          <button onclick="submitFeedComment('${moment.id}')" class="px-2.5 py-1.5 bg-secondary-container neo-border-sm rounded-lg text-xs font-bold active-press">
            Kirim
          </button>
        </div>
      </article>
    `;
  }).join('');
}

// --- Feed Reaction Handler ---
async function handleFeedReaction(momentId, emoji, event) {
  const targetMoment = moments.find(m => m.id === momentId);
  if (!targetMoment) return;

  if (!targetMoment.reactions) targetMoment.reactions = {};
  targetMoment.reactions[emoji] = (targetMoment.reactions[emoji] || 0) + 1;
  saveData();

  vibrate(30);
  playSound('heart');

  if (event && event.target) {
    const rect = event.target.getBoundingClientRect();
    spawnFloatingEmoji(emoji, rect.left + rect.width / 2, rect.top);
  }

  if (isSupabaseReady() && currentUser) {
    const supabase = getSupabase();
    await supabase.from('reactions').insert({
      pap_id: momentId,
      user_id: currentUser.id,
      user_name: coupleData.users[currentUser.id]?.name || 'Pasangan',
      emoji
    });
    
    // Kirim notifikasi reaksi
    sendPushNotification('Reaksi Baru! ' + emoji, `${coupleData.users[currentUser.id]?.name || 'Pasangan'} bereaksi pada PAP Anda!`, { event: 'reaction' });
  }

  renderFeed(currentFilter);
}

function spawnFloatingEmoji(emoji, x, y) {
  const floater = document.createElement('div');
  floater.className = 'floating-emoji';
  floater.innerText = emoji;
  floater.style.left = `${x}px`;
  floater.style.top = `${y}px`;
  document.body.appendChild(floater);

  setTimeout(() => {
    floater.remove();
  }, 1000);
}

async function submitFeedComment(momentId) {
  const inputEl = document.getElementById(`replyInput-${momentId}`);
  if (!inputEl || !inputEl.value.trim()) return;

  const targetMoment = moments.find(m => m.id === momentId);
  if (!targetMoment) return;

  const activeUser = coupleData.users[coupleData.activeUser] || { id: currentUser?.id, name: 'Pengguna' };
  const commentText = inputEl.value.trim();
  const newComment = {
    senderId: activeUser.id,
    senderName: activeUser.name,
    text: commentText
  };

  if (!targetMoment.comments) targetMoment.comments = [];
  targetMoment.comments.push(newComment);

  saveData();
  vibrate(25);
  playSound('toast');
  showToast('Balasan terkirim ke pasangan! 💬', 'send');

  if (isSupabaseReady() && currentUser) {
    const supabase = getSupabase();
    await supabase.from('comments').insert({
      pap_id: momentId,
      user_id: currentUser.id,
      user_name: activeUser.name,
      text: commentText
    });
    
    // Kirim notifikasi komentar
    sendPushNotification('Komentar Baru! 💬', `${activeUser.name}: "${commentText}"`, { event: 'comment' });
  }

  inputEl.value = '';
  renderFeed(currentFilter);
}

// --- Simulated Android Widget Sync ---
function updateSimulatedWidget() {
  const dynamicContainer = document.getElementById('widgetDynamicContent');
  const clockEl = document.getElementById('androidClock');

  const now = new Date();
  if (clockEl) {
    clockEl.innerText = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  }

  if (!dynamicContainer) return;

  if (moments.length === 0) {
    dynamicContainer.innerHTML = `<div class="w-full h-full flex items-center justify-center text-xs text-on-surface-variant font-bold p-5 text-center">Belum ada PAP. Ayo kirim PAP pertamamu!</div>`;
    return;
  }
  const latestMoment = moments[0];

  const senderName = latestMoment.senderName || 'Pasangan';

  if (widgetSize === 'landscape') {
    dynamicContainer.innerHTML = `
      <div class="flex items-stretch gap-2.5 w-full">
        <div class="w-[48%] aspect-[4/3] rounded-xl overflow-hidden neo-border-sm bg-surface-dim relative shrink-0">
          <img src="${latestMoment.image}" alt="PAP Widget" class="w-full h-full object-cover"/>
          <span class="absolute bottom-1 left-1 bg-primary-container text-white text-[9px] font-bold px-1.5 py-0.5 rounded neo-border-sm shadow-sm">
            ${senderName} ❤️
          </span>
        </div>
        <div class="w-[52%] flex flex-col justify-between py-0.5">
          <div>
            <div class="flex items-center justify-between gap-1 mb-1">
              <span class="font-label-bold text-[10px] font-extrabold text-primary flex items-center gap-0.5">
                <span>❤️</span> Octoleven
              </span>
              <span class="text-[9px] font-bold bg-secondary-container px-1.5 py-0.5 rounded neo-border-sm text-on-secondary-container">
                ${formatTimeAgo(latestMoment.timestamp)}
              </span>
            </div>
            <p class="text-[11px] font-bold text-on-background line-clamp-3 leading-snug">
              "${latestMoment.caption}"
            </p>
          </div>
          <div class="flex items-center justify-between mt-1 pt-1 border-t border-outline-variant/30">
            <span class="text-[9px] font-bold text-primary bg-surface-container px-1.5 py-0.5 rounded neo-border-sm">
              ${latestMoment.sticker || 'PAP ✨'}
            </span>
            <button onclick="event.stopPropagation(); triggerWidgetQuickReaction()" class="w-6 h-6 rounded-full bg-secondary-container flex items-center justify-center neo-border-sm text-[10px] active-press hover:scale-110" title="Kirim Cinta">
              ❤️
            </button>
          </div>
        </div>
      </div>
    `;
  } else if (widgetSize === 'medium') {
    dynamicContainer.innerHTML = `
      <div class="space-y-1.5 w-full">
        <div class="flex justify-between items-center mb-1">
          <div class="flex items-center gap-1">
            <div class="w-4 h-4 rounded-full bg-primary flex items-center justify-center text-[8px] text-white">❤️</div>
            <span class="font-label-bold text-[11px] font-bold text-primary">Octoleven PAP</span>
          </div>
          <span class="text-[9px] font-bold bg-secondary-container px-2 py-0.5 rounded-full neo-border-sm text-on-secondary-container">
            ${formatTimeAgo(latestMoment.timestamp)}
          </span>
        </div>
        <div class="relative rounded-xl overflow-hidden neo-border-sm bg-surface-dim aspect-[16/9]">
          <img src="${latestMoment.image}" alt="PAP Widget" class="w-full h-full object-cover"/>
          <span class="absolute bottom-1.5 left-1.5 bg-primary-container text-white text-[10px] font-bold px-2 py-0.5 rounded neo-border-sm">
            Dari ${senderName}
          </span>
        </div>
        <div class="flex justify-between items-center gap-2 pt-0.5">
          <p class="text-[11px] font-bold text-on-background line-clamp-1 flex-1">"${latestMoment.caption}"</p>
          <button onclick="event.stopPropagation(); triggerWidgetQuickReaction()" class="w-6 h-6 rounded-full bg-secondary-container flex items-center justify-center neo-border-sm active-press text-[10px]" title="Kirim Reaksi">❤️</button>
        </div>
      </div>
    `;
  } else if (widgetSize === 'small') {
    dynamicContainer.innerHTML = `
      <div class="space-y-1 max-w-[170px] mx-auto">
        <div class="relative rounded-xl overflow-hidden neo-border-sm bg-surface-dim aspect-square">
          <img src="${latestMoment.image}" alt="PAP Widget" class="w-full h-full object-cover"/>
          <span class="absolute top-1 right-1 bg-secondary-container text-on-secondary-container text-[8px] font-bold px-1.5 py-0.5 rounded neo-border-sm">
            ${formatTimeAgo(latestMoment.timestamp)}
          </span>
          <span class="absolute bottom-1 left-1 bg-primary-container text-white text-[9px] font-bold px-1.5 py-0.5 rounded neo-border-sm">
            ${senderName}
          </span>
        </div>
        <p class="text-[10px] font-bold text-on-background line-clamp-1 text-center">"${latestMoment.caption}"</p>
      </div>
    `;
  }

  // --- NATIVE ANDROID WIDGET SYNC ---
  if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.WidgetPlugin) {
    if (latestMoment && latestMoment.image) {
      let senderType = "all";
      if (latestMoment.senderName && latestMoment.senderName.toLowerCase().includes("rio")) senderType = "rio";
      if (latestMoment.senderName && latestMoment.senderName.toLowerCase().includes("nindya")) senderType = "nindya";

      window.Capacitor.Plugins.WidgetPlugin.updateWidget({ 
        imageUrl: latestMoment.image, 
        sender: senderType,
        senderName: senderName,
        caption: latestMoment.caption || '',
        timeText: formatTimeAgo(latestMoment.timestamp),
        tagText: latestMoment.sticker || 'PAP ✨'
      })
        .then(() => console.log('Native Android Widget updated successfully!'))
        .catch(err => console.error('Failed to update Native Widget:', err));
    }
  }
}

function setWidgetSize(size) {
  widgetSize = size;
  const container = document.getElementById('simulatedWidgetContainer');
  const btnLandscape = document.getElementById('btnWidgetLandscape');
  const btnMedium = document.getElementById('btnWidgetMedium');
  const btnSmall = document.getElementById('btnWidgetSmall');

  const activeBtnClass = 'flex-1 py-2 px-2 rounded-xl neo-border-sm font-label-bold text-xs bg-secondary-container text-on-secondary-container active-press whitespace-nowrap';
  const inactiveBtnClass = 'flex-1 py-2 px-2 rounded-xl neo-border-sm font-label-bold text-xs bg-surface text-on-surface-variant active-press whitespace-nowrap';

  if (btnLandscape) btnLandscape.className = size === 'landscape' ? activeBtnClass : inactiveBtnClass;
  if (btnMedium) btnMedium.className = size === 'medium' ? activeBtnClass : inactiveBtnClass;
  if (btnSmall) btnSmall.className = size === 'small' ? activeBtnClass : inactiveBtnClass;

  if (size === 'small') {
    if (container) container.className = 'octo-widget bg-surface rounded-2xl p-2.5 relative cursor-pointer max-w-[190px] mx-auto transition-all';
  } else {
    if (container) container.className = 'octo-widget bg-surface rounded-2xl p-2.5 relative cursor-pointer w-full transition-all';
  }

  vibrate(20);
  updateSimulatedWidget();
}

function triggerWidgetQuickReaction() {
  playSound('heart');
  vibrate(50);
  showToast('Reaksi ❤️ dikirim dari Widget ke HP Pasangan!', 'favorite');
  
  if (moments.length > 0) {
    handleFeedReaction(moments[0].id, '❤️', null);
  }
}

async function simulatePartnerPapDrop() {
  const captions = [
    'Lagi mampir ke toko bunga, liat bunga mawar jadi inget kamu 🌹',
    'Baru aja selesai ngerjain tugas, kangen banget pengen telponan 🥺',
    'Minum boba favorit kita berdua! Enak bangett 🧋',
    'Tadi di jalan liat kucing lucu mirip kamu hehe 🐱'
  ];

  const randomImage = SAMPLE_PRESET_PHOTOS[Math.floor(Math.random() * SAMPLE_PRESET_PHOTOS.length)];
  const randomCaption = captions[Math.floor(Math.random() * captions.length)];

  if (isSupabaseReady() && currentUser) {
    const supabase = getSupabase();
    const { error } = await supabase.from('paps').insert({
      couple_id: coupleData.id,
      sender_id: currentUser.id,
      sender_name: 'Nadia (Simulasi)',
      photo_url: randomImage,
      sticker: 'Spontan ✨',
      caption: randomCaption,
      like_count: 1
    });

    if (!error) {
      showToast('PAP simulasi tersinkron ke Supabase Realtime! 💖', 'cloud_done');
      return;
    }
  }

  const newDrop = {
    id: `sim-${Date.now()}`,
    coupleId: coupleData.id || 'couple-1',
    senderId: currentUser?.id || 'sim-user',
    senderName: 'Nadia (Simulasi)',
    image: randomImage,
    caption: randomCaption,
    sticker: 'Spontan ✨',
    timestamp: new Date().toISOString(),
    reactions: { '❤️': 1 },
    comments: []
  };

  moments.unshift(newDrop);
  saveData();
  renderHomeView();
  renderFeed(currentFilter);
  updateSimulatedWidget();
}

// --- PAP Capture & Upload Studio Modal ---
function openPapModal() {
  currentCapturedImage = null;
  currentMediaFile = null;
  selectedSticker = 'Cafe ☕';

  requestNotificationPermission();

  const modal = document.getElementById('papModal');
  const imgPreview = document.getElementById('imagePreview');
  const videoEl = document.getElementById('cameraVideo');
  const placeholder = document.getElementById('cameraPlaceholder');
  const controls = document.getElementById('activeCameraControls');
  const badgeOverlay = document.getElementById('previewBadgeOverlay');
  const captionInput = document.getElementById('papCaptionInput');

  if (imgPreview) imgPreview.classList.add('hidden');
  if (videoEl) videoEl.classList.add('hidden');
  if (placeholder) placeholder.classList.remove('hidden');
  if (controls) controls.classList.add('hidden');
  if (badgeOverlay) badgeOverlay.classList.add('hidden');
  if (captionInput) captionInput.value = '';

  updateStickerButtons();
  if (modal) modal.classList.remove('hidden');
}

function closePapModal() {
  stopLiveCamera();
  const modal = document.getElementById('papModal');
  if (modal) modal.classList.add('hidden');
}

async function startLiveCamera() {
  try {
    const videoEl = document.getElementById('cameraVideo');
    const placeholder = document.getElementById('cameraPlaceholder');
    const controls = document.getElementById('activeCameraControls');
    const imgPreview = document.getElementById('imagePreview');

    if (imgPreview) imgPreview.classList.add('hidden');

    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: currentFacingMode,
          width: { ideal: 1920, max: 3840 },
          height: { ideal: 1080, max: 2160 }
        },
        audio: false
      });
      videoEl.srcObject = mediaStream;
      videoEl.classList.remove('hidden');
      placeholder.classList.add('hidden');
      controls.classList.remove('hidden');
    } else {
      showToast('Kamera tidak didukung di browser ini. Silakan pilih dari galeri.', 'warning');
    }
  } catch (err) {
    showToast('Izin kamera ditolak. Silakan gunakan unggah foto galeri.', 'warning');
  }
}

function stopLiveCamera() {
  if (mediaStream) {
    mediaStream.getTracks().forEach(track => track.stop());
    mediaStream = null;
  }
  const videoEl = document.getElementById('cameraVideo');
  if (videoEl) videoEl.classList.add('hidden');
}

function switchCameraFacing() {
  currentFacingMode = currentFacingMode === 'user' ? 'environment' : 'user';
  stopLiveCamera();
  startLiveCamera();
}

function takeCameraSnap() {
  const videoEl = document.getElementById('cameraVideo');
  const canvas = document.getElementById('captureCanvas');
  const imgPreview = document.getElementById('imagePreview');
  const controls = document.getElementById('activeCameraControls');
  const badgeOverlay = document.getElementById('previewBadgeOverlay');

  if (!videoEl || !canvas) return;

  canvas.width = videoEl.videoWidth || 1280;
  canvas.height = videoEl.videoHeight || 1280;
  const ctx = canvas.getContext('2d');
  
  // Balikkan (mirror) hasil foto agar sama persis dengan preview layar
  if (currentFacingMode === 'user') {
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
  }
  
  ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);

  currentCapturedImage = canvas.toDataURL('image/jpeg', 0.92);
  currentMediaFile = null;

  playSound('snap');
  vibrate(50);
  stopLiveCamera();

  imgPreview.src = currentCapturedImage;
  imgPreview.classList.remove('hidden');
  controls.classList.add('hidden');
  if (badgeOverlay) {
    badgeOverlay.innerText = selectedSticker;
    badgeOverlay.classList.remove('hidden');
  }
}

function handleFileSelected(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  currentMediaFile = file;

  const reader = new FileReader();
  reader.onload = function(e) {
    currentCapturedImage = e.target.result;
    const imgPreview = document.getElementById('imagePreview');
    const placeholder = document.getElementById('cameraPlaceholder');
    const badgeOverlay = document.getElementById('previewBadgeOverlay');

    stopLiveCamera();
    if (placeholder) placeholder.classList.add('hidden');
    if (imgPreview) {
      imgPreview.src = currentCapturedImage;
      imgPreview.classList.remove('hidden');
    }
    if (badgeOverlay) {
      badgeOverlay.innerText = selectedSticker;
      badgeOverlay.classList.remove('hidden');
    }
    playSound('snap');
    vibrate(30);
  };
  reader.readAsDataURL(file);
}

function pickSamplePhoto(index) {
  currentCapturedImage = SAMPLE_PRESET_PHOTOS[index] || SAMPLE_PRESET_PHOTOS[0];
  currentMediaFile = null;
  const imgPreview = document.getElementById('imagePreview');
  const placeholder = document.getElementById('cameraPlaceholder');
  const badgeOverlay = document.getElementById('previewBadgeOverlay');

  stopLiveCamera();
  if (placeholder) placeholder.classList.add('hidden');
  if (imgPreview) {
    imgPreview.src = currentCapturedImage;
    imgPreview.classList.remove('hidden');
  }
  if (badgeOverlay) {
    badgeOverlay.innerText = selectedSticker;
    badgeOverlay.classList.remove('hidden');
  }
  playSound('snap');
  vibrate(30);
}

function selectSticker(name) {
  selectedSticker = name;
  updateStickerButtons();

  const badgeOverlay = document.getElementById('previewBadgeOverlay');
  if (badgeOverlay) {
    badgeOverlay.innerText = selectedSticker;
  }
  vibrate(15);
}

function updateStickerButtons() {
  document.querySelectorAll('.sticker-btn').forEach(btn => {
    if (btn.innerText.includes(selectedSticker)) {
      btn.className = 'sticker-btn px-2.5 py-1 rounded-full neo-border-sm text-xs font-bold bg-secondary-container text-on-secondary-container shadow-sm';
    } else {
      btn.className = 'sticker-btn px-2.5 py-1 rounded-full neo-border-sm text-xs font-bold bg-surface hover:bg-secondary-container transition-colors';
    }
  });
}

// --- Submit New PAP to Supabase Storage & Database ---
async function submitNewPap() {
  if (!currentCapturedImage && !currentMediaFile) {
    showToast('Pilih atau ambil foto terlebih dahulu!', 'warning');
    vibrate(60);
    return;
  }

  const captionInput = document.getElementById('papCaptionInput');
  const caption = captionInput?.value.trim() || 'PAP hari ini buat kamu tersayang! ❤️';
  const activeUser = coupleData.users[coupleData.activeUser] || { name: 'Pengguna' };

  closePapModal();
  playSound('heart');
  vibrate([40, 60, 40]);
  showToast('Mengunggah foto ke Supabase Storage... 🚀', 'cloud_upload');

  let publicPhotoUrl = currentCapturedImage;

  if (isSupabaseReady() && currentUser) {
    const supabase = getSupabase();
    try {
      // 1. Prepare File / Blob
      let fileToUpload = currentMediaFile;
      if (!fileToUpload && currentCapturedImage?.startsWith('data:')) {
        fileToUpload = dataURItoBlob(currentCapturedImage);
      }

      if (fileToUpload) {
        const fileExt = fileToUpload.type === 'image/png' ? 'png' : 'jpg';
        const fileName = `${coupleData.id}/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;

        // Upload to bucket 'pap-photos'
        const { error: uploadError } = await supabase.storage
          .from('pap-photos')
          .upload(fileName, fileToUpload, {
            contentType: fileToUpload.type || 'image/jpeg',
            upsert: true
          });

        if (!uploadError) {
          const { data: publicUrlData } = supabase.storage
            .from('pap-photos')
            .getPublicUrl(fileName);
          publicPhotoUrl = publicUrlData.publicUrl;
        } else {
          console.warn('Gagal unggah ke Supabase Storage, menggunakan foto langsung:', uploadError.message);
        }
      }

      // 2. Insert Database Record
      const { error: dbError } = await supabase.from('paps').insert({
        couple_id: coupleData.id,
        sender_id: currentUser.id,
        sender_name: activeUser.name,
        sender_avatar: activeUser.avatar || '',
        photo_url: publicPhotoUrl,
        sticker: selectedSticker,
        caption: caption,
        like_count: 1
      });

      if (dbError) throw dbError;

      showToast('PAP tersimpan di Supabase! 💖', 'check_circle');
      
      // Kirim Push Notification dengan payload widget update
      sendPushNotification('PAP Baru Masuk! 📸', `${activeUser.name} ngirim PAP nih, cek sekarang!`, { 
        event: 'new_pap',
        widget_update: 'true',
        imageUrl: publicPhotoUrl,
        senderName: activeUser.name,
        caption: caption || '',
        tagText: selectedSticker || 'PAP ✨'
      });
      
      fetchMomentsFromSupabase();
      return;
    } catch (err) {
      console.warn('Supabase Error:', err.message);
    }
  }

  // Fallback local persistence
  const newMoment = {
    id: `mom-${Date.now()}`,
    coupleId: coupleData.id || 'couple-1',
    senderId: currentUser?.id || 'local-user',
    senderName: activeUser.name,
    image: publicPhotoUrl,
    caption: caption,
    sticker: selectedSticker,
    timestamp: new Date().toISOString(),
    reactions: { '❤️': 1 },
    comments: []
  };
  moments.unshift(newMoment);
  saveData();
  renderHomeView();
  renderFeed(currentFilter);
  updateSimulatedWidget();
  showToast('PAP tersimpan di perangkat (Mode Offline)! 💖', 'check_circle');

  spawnFloatingEmoji('💖', window.innerWidth / 2, window.innerHeight / 2);
}

// --- Mood Tracker Logic ---
function openMoodPickerModal() {
  const modal = document.getElementById('moodModal');
  if (modal) modal.classList.remove('hidden');
}

function closeMoodPickerModal() {
  const modal = document.getElementById('moodModal');
  if (modal) modal.classList.add('hidden');
}

async function setUserMood(emoji, text) {
  const currentKey = coupleData.activeUser;
  const activeUser = coupleData.users[currentKey] || { id: currentUser?.id };
  activeUser.moodEmoji = emoji;
  activeUser.moodText = text;
  saveData();

  closeMoodPickerModal();
  playSound('toast');
  vibrate(30);
  showToast(`Mood kamu diperbarui: ${emoji} "${text}"`, 'mood');
  updateUIForActiveUser();

  if (isSupabaseReady() && currentUser) {
    const supabase = getSupabase();
    await supabase.from('members').upsert({
      id: currentUser.id,
      couple_id: coupleData.id,
      name: activeUser.name || 'Pengguna',
      mood_emoji: emoji,
      mood_text: text,
      updated_at: new Date().toISOString()
    });
  }
}

// --- Love Poke Action ---
async function sendLovePoke() {
  const activeUser = coupleData.users[coupleData.activeUser];
  const partner = Object.values(coupleData.users).find((user) => user.id !== activeUser?.id);
  const partnerName = partner?.name || 'pasanganmu';

  playSound('heart');
  vibrate([50, 50, 50]);
  showToast(`Love poke terkirim ke ${partnerName}! 💖 "Aku kangen kamu!"`, 'favorite');

  spawnFloatingEmoji('❤️', window.innerWidth - 60, 60);
  spawnFloatingEmoji('🥰', window.innerWidth - 80, 80);

  if (isSupabaseReady() && supabaseRealtimeChannel && currentUser) {
    supabaseRealtimeChannel.send({
      type: 'broadcast',
      event: 'love_poke',
      payload: { 
        senderId: currentUser.id, 
        senderName: activeUser.name 
      }
    });
  }

  // Kirim ke backend Vercel untuk Push Notification
  sendPushNotification('Panggilan Rindu! 🥺', `${activeUser.name} kangen banget sama kamu!`, { event: 'love_poke' });
}

// --- Push Notification Helper ---
async function sendPushNotification(title, body, data = {}) {
    if (!isSupabaseReady() || !currentUser) return;
    try {
        const supabase = getSupabase();
        
        // Ambil token pasangan dari Supabase
        const { data: members, error } = await supabase
            .from('members')
            .select('fcm_token')
            .neq('id', currentUser.id)
            .limit(1);
            
        if (error || !members || members.length === 0 || !members[0].fcm_token) return;
        
        const partnerToken = members[0].fcm_token;
        
        // Kirim HTTP POST ke Vercel Serverless Function
        await fetch('/api/fcm', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                token: partnerToken,
                title: title,
                body: body,
                data: data
            })
        });
    } catch (err) {
        console.error('Push error:', err);
    }
}

// --- Pairing & Code Helpers ---
function copyInviteCode() {
  const code = coupleData.inviteCode || 'OCTO-7K92';
  navigator.clipboard.writeText(code).then(() => {
    const copyText = document.getElementById('copyCodeText');
    const copyIcon = document.getElementById('copyCodeIcon');
    if (copyText) copyText.innerText = 'Tersalin!';
    if (copyIcon) copyIcon.innerText = 'check';

    playSound('toast');
    vibrate(30);
    showToast(`Kode ${code} berhasil disalin ke clipboard!`, 'content_copy');

    setTimeout(() => {
      if (copyText) copyText.innerText = 'Salin';
      if (copyIcon) copyIcon.innerText = 'content_copy';
    }, 2000);
  });
}

function shareInviteLink() {
  const code = coupleData.inviteCode || 'OCTO-7K92';
  const shareText = `Yuk pasangan di aplikasi Couple PAP Octoleven! Kode ruang kita: ${code}`;
  if (navigator.share) {
    navigator.share({
      title: 'Octoleven Couple PAP',
      text: shareText,
      url: window.location.href
    }).catch(() => {});
  } else {
    copyInviteCode();
  }
}

async function connectPartnerCode() {
  const input = document.getElementById('inputPartnerCode');
  const code = input?.value.trim().toUpperCase();

  if (!code) {
    showToast('Masukkan kode pasangan terlebih dahulu!', 'warning');
    return;
  }

  if (!isSupabaseReady() || !currentUser) {
    showToast('Supabase belum terhubung. Pastikan sudah login.', 'error');
    return;
  }

  try {
    const supabase = getSupabase();
    const { data: pairCode, error: codeErr } = await supabase
      .from('pair_codes')
      .select('*')
      .eq('code', code)
      .single();

    if (codeErr || !pairCode) {
      throw new Error('Kode pasangan tidak valid atau tidak ditemukan.');
    }

    const workspaceId = pairCode.couple_id;

    // Update current member couple_id
    await supabase.from('members').upsert({
      id: currentUser.id,
      couple_id: workspaceId,
      name: currentUser.user_metadata?.full_name || 'Pengguna',
      updated_at: new Date().toISOString()
    });

    await hydrateWorkspace(workspaceId);
    initSupabaseRealtime();
    vibrate(50);
    playSound('heart');
    showToast(`Berhasil terhubung ke ruang ${code}! ❤️`, 'verified');
    if (input) input.value = '';
  } catch (error) {
    console.error('Pairing gagal:', error);
    showToast(error.message || 'Gagal menghubungkan pasangan.', 'warning');
  }
}

// --- AVATAR UPLOAD ---
async function handleAvatarUpload(event) {
  const file = event.target.files[0];
  if (!file) return;
  const supabase = getSupabase();
  if (!supabase || !currentUser) return;

  try {
    const fileExt = file.name.split('.').pop();
    const fileName = `avatar_${currentUser.id}_${Date.now()}.${fileExt}`;
    const filePath = `avatars/${fileName}`;

    alert('Sedang mengunggah foto profil, mohon tunggu sebentar...');

    // Upload ke bucket pap-photos
    const { error: uploadError } = await supabase.storage.from('pap-photos').upload(filePath, file, { upsert: true });
    if (uploadError) throw uploadError;

    const { data: publicUrlData } = supabase.storage.from('pap-photos').getPublicUrl(filePath);
    const publicURL = publicUrlData.publicUrl;

    // Update di tabel members
    const { error: updateError } = await supabase
      .from('members')
      .update({ avatar: publicURL, updated_at: new Date().toISOString() })
      .eq('id', currentUser.id);

    if (updateError) throw updateError;

    // Update lokal & re-render
    coupleData.users[currentUser.id].avatar = publicURL;
    updateUIForActiveUser();
    alert('Foto profil berhasil diubah!');
  } catch (err) {
    console.error('Error uploading avatar:', err);
    alert('Gagal mengunggah foto profil.');
  }
}

// --- AGENDA & NOTIFIKASI ---
function openAgendaModal() {
  const modal = document.getElementById('agendaModal');
  const modalContent = document.getElementById('agendaModalContent');
  if (!modal || !modalContent) return;

  modal.classList.remove('opacity-0', 'pointer-events-none');
  modalContent.classList.remove('scale-95');
  modalContent.classList.add('scale-100');
}

function closeAgendaModal() {
  const modal = document.getElementById('agendaModal');
  const modalContent = document.getElementById('agendaModalContent');
  if (!modal || !modalContent) return;

  modal.classList.add('opacity-0', 'pointer-events-none');
  modalContent.classList.remove('scale-100');
  modalContent.classList.add('scale-95');
}

async function submitAgenda() {
  const title = document.getElementById('agendaTitleInput').value.trim();
  const dateStr = document.getElementById('agendaDateInput').value;
  const timeStr = document.getElementById('agendaTimeInput').value;

  if (!title || !dateStr || !timeStr) {
    alert('Mohon lengkapi semua kolom agenda!');
    return;
  }

  const scheduleDate = new Date(`${dateStr}T${timeStr}:00`);
  if (scheduleDate < new Date()) {
    alert('Waktu agenda tidak boleh di masa lalu!');
    return;
  }

  const supabase = getSupabase();
  if (!supabase || !currentUser) return;

  try {
    // Simpan ke DB members
    const { error } = await supabase
      .from('members')
      .update({
        next_date_label: title,
        next_date_time: scheduleDate.toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', currentUser.id);

    if (error) throw error;

    // Set Local Notification via Capacitor jika tersedia
    if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.LocalNotifications) {
      const LocalNotifications = window.Capacitor.Plugins.LocalNotifications;
      
      // Minta izin
      let permStatus = await LocalNotifications.checkPermissions();
      if (permStatus.display !== 'granted') {
        permStatus = await LocalNotifications.requestPermissions();
      }

      if (permStatus.display === 'granted') {
        await LocalNotifications.schedule({
          notifications: [
            {
              title: "Alarm Agenda Pasangan! ❤️",
              body: `Waktunya: ${title} sekarang!`,
              id: Math.floor(Math.random() * 100000),
              schedule: { at: scheduleDate },
              sound: null,
              attachments: null,
              actionTypeId: "",
              extra: null
            }
          ]
        });
        console.log('Notifikasi lokal berhasil dijadwalkan!');
      }
    }

    closeAgendaModal();
    
    // Update Lokal & UI
    coupleData.users[currentUser.id].nextDateLabel = title;
    coupleData.users[currentUser.id].nextDateTime = scheduleDate.toISOString();
    
    // Kirim notifikasi agenda
    sendPushNotification('Agenda Baru Pasangan! 📅', `${currentUser.name} akan ${title} pada ${scheduleDate.toLocaleString('id-ID')}`, { event: 'agenda' });

    updateUIForActiveUser(); // ini tidak meng-update text di index.html, mari kita perbarui
    
    // Manual Update Text di UI (Bento box)
    const agendaTitleEls = document.querySelectorAll('h4.text-on-tertiary-container');
    agendaTitleEls.forEach(el => {
       if(el.innerText === 'Agenda Terdekat' || el.innerText.includes('Agenda')) {
           el.innerText = title;
           el.nextElementSibling.innerText = scheduleDate.toLocaleString('id-ID');
       }
    });

    alert('Agenda berhasil disimpan dan Alarm terpasang!');
  } catch (error) {
    console.error('Gagal menyimpan agenda:', error);
    alert('Terjadi kesalahan saat menyimpan agenda.');
  }
}

// --- Initial Setup on Page Load ---
document.addEventListener('DOMContentLoaded', () => {
  renderHomeView();
  renderFeed('all');
  updateSimulatedWidget();
  updateStickerButtons();

  setInterval(() => {
    const clockEl = document.getElementById('androidClock');
    if (clockEl) {
      const now = new Date();
      clockEl.innerText = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    }
  }, 10000);
});

// --- Widget Pinning ---
window.requestPinWidget = async function() {
  if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.WidgetPlugin) {
    try {
      await window.Capacitor.Plugins.WidgetPlugin.pinWidget();
      showToast('Berhasil memasang widget!', 'add_to_home_screen');
    } catch (e) {
      showToast('Gagal: ' + (e.message || ''), 'error');
    }
  } else {
    showToast('Fitur ini hanya tersedia di HP Android.', 'warning');
  }
};
