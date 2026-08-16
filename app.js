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

// --- Client-Side Smart Image Compressor ---
async function compressImage(source, maxWidth = 1280, maxHeight = 1280, quality = 0.85) {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      let width = img.width;
      let height = img.height;

      if (width > maxWidth || height > maxHeight) {
        if (width > height) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        } else {
          width = Math.round((width * maxHeight) / height);
          height = maxHeight;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
          resolve({ blob, dataUrl: compressedDataUrl });
        },
        'image/jpeg',
        quality
      );
    };
    img.onerror = () => {
      resolve({ blob: null, dataUrl: typeof source === 'string' ? source : null });
    };

    if (typeof source === 'string') {
      img.src = source;
    } else if (source instanceof Blob || source instanceof File) {
      img.src = URL.createObjectURL(source);
    } else {
      resolve({ blob: null, dataUrl: null });
    }
  });
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

// --- Fun & Cute Animation Helpers ---
function triggerConfetti() {
  const colors = ['#ff6b8a', '#fed74c', '#4ea5d9', '#ad2c4e', '#00658f', '#ffffff'];
  for (let i = 0; i < 35; i++) {
    const piece = document.createElement('div');
    piece.className = 'confetti-piece';
    piece.style.left = `${Math.random() * 100}vw`;
    piece.style.top = `${window.scrollY + Math.random() * 100}px`;
    piece.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
    piece.style.width = `${Math.random() * 8 + 6}px`;
    piece.style.height = `${Math.random() * 12 + 6}px`;
    piece.style.animationDuration = `${Math.random() * 1.2 + 1.2}s`;
    document.body.appendChild(piece);
    setTimeout(() => piece.remove(), 2500);
  }
}

function spawnFloatingEmoji(emoji, x, y) {
  const floater = document.createElement('div');
  floater.className = 'floating-particle';
  floater.innerText = emoji;
  floater.style.left = `${x || window.innerWidth / 2}px`;
  floater.style.top = `${y || window.innerHeight / 2}px`;
  floater.style.setProperty('--drift-x', `${(Math.random() - 0.5) * 80}px`);
  floater.style.setProperty('--rot', `${(Math.random() - 0.5) * 40}deg`);
  document.body.appendChild(floater);
  setTimeout(() => floater.remove(), 1300);
}

function triggerHeartBurst(x, y) {
  const emojis = ['❤️', '💖', '🥰', '✨', '🥺'];
  for (let i = 0; i < 6; i++) {
    setTimeout(() => {
      const offsetX = (Math.random() - 0.5) * 60;
      const offsetY = (Math.random() - 0.5) * 40;
      spawnFloatingEmoji(emojis[i % emojis.length], (x || window.innerWidth / 2) + offsetX, (y || window.innerHeight / 2) + offsetY);
    }, i * 70);
  }
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

      const isVideo = false;
      return {
        id: p.id,
        coupleId: p.couple_id,
        senderId: p.sender_id,
        senderName: p.sender_name,
        senderAvatar: p.sender_avatar,
        image: p.photo_url,
        videoUrl: p.video_url || null,
        isVideo: isVideo,
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
    .on('broadcast', { event: 'new_pap' }, (payload) => {
      const data = payload?.payload || {};
      if (data.senderId !== currentUser?.id) {
        showToast(`${data.senderName || 'Pasangan'} baru saja mengirim PAP! 📸`, 'add_a_photo');
        playSound('camera');
        vibrate([100, 50, 100]);
        triggerLocalNotification('PAP Baru Masuk! 📸', `${data.senderName || 'Pasangan'} baru saja mengirim PAP spesial untukmu!`, data.imageUrl);
        fetchMomentsFromSupabase();
      }
    })
    .on('broadcast', { event: 'love_poke' }, (payload) => {
      const data = payload?.payload || {};
      if (data.senderId !== currentUser?.id) {
        showToast(`${data.senderName || 'Pasangan'} lagi kangen banget sama kamu! 🥺❤️`, 'favorite');
        playSound('heart');
        vibrate([50, 100, 50, 100, 50]);
        spawnFloatingEmoji('❤️', window.innerWidth / 2, 100);
        triggerLocalNotification('Panggilan Rindu! 🥺❤️', `${data.senderName || 'Pasangan'} lagi kangen banget sama kamu!`);
      }
    })
    .on('broadcast', { event: 'reaction' }, (payload) => {
      const data = payload?.payload || {};
      if (data.senderId !== currentUser?.id) {
        showToast(`${data.senderName || 'Pasangan'} bereaksi ${data.emoji || '❤️'} pada PAP kamu!`, 'favorite');
        playSound('pop');
        vibrate(40);
        triggerLocalNotification('Reaksi Baru! ❤️', `${data.senderName || 'Pasangan'} bereaksi pada foto kamu!`);
        fetchMomentsFromSupabase();
      }
    })
    .on('broadcast', { event: 'comment' }, (payload) => {
      const data = payload?.payload || {};
      if (data.senderId !== currentUser?.id) {
        showToast(`Komentar baru dari ${data.senderName || 'Pasangan'}: "${data.commentText || ''}"`, 'chat_bubble');
        playSound('toast');
        vibrate(40);
        triggerLocalNotification('Komentar Baru! 💬', `${data.senderName || 'Pasangan'}: ${data.commentText || 'mengomentari fotomu'}`);
        fetchMomentsFromSupabase();
      }
    })
    .on('broadcast', { event: 'mood' }, (payload) => {
      const data = payload?.payload || {};
      if (data.senderId !== currentUser?.id) {
        showToast(`Status mood ${data.senderName || 'Pasangan'} diperbarui: ${data.emoji || '🥰'} ${data.moodText || ''}`, 'sentiment_satisfied');
        vibrate(30);
        triggerLocalNotification('Status Mood Pasangan ✨', `${data.senderName || 'Pasangan'} sekarang lagi ${data.emoji || '🥰'} ${data.moodText || ''}`);
        updateUIForActiveUser();
      }
    })
    .on('broadcast', { event: 'agenda' }, (payload) => {
      const data = payload?.payload || {};
      if (data.senderId !== currentUser?.id) {
        showToast(`Agenda baru: "${data.title || ''}" oleh ${data.senderName || 'Pasangan'} 📅`, 'calendar_month');
        playSound('toast');
        vibrate([50, 100, 50]);
        triggerLocalNotification('Agenda Baru Pasangan! 📅', `${data.senderName || 'Pasangan'} menambahkan agenda: ${data.title || ''}`);
        updateUIForActiveUser();
      }
    })
    .subscribe();

  fetchMomentsFromSupabase();
}

// Helper to trigger Local Device Notification
async function triggerLocalNotification(title, body, imageUrl = null) {
  // 1. Capacitor Local Notifications (Android Native)
  if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.LocalNotifications) {
    try {
      const LocalNotifications = window.Capacitor.Plugins.LocalNotifications;
      let permStatus = await LocalNotifications.checkPermissions();
      if (permStatus.display !== 'granted') {
        permStatus = await LocalNotifications.requestPermissions();
      }

      if (permStatus.display === 'granted') {
        const notifObj = {
          title: title,
          body: body,
          id: Math.floor(Math.random() * 1000000),
          schedule: { at: new Date(Date.now() + 500) }
        };
        if (imageUrl) {
          notifObj.largeBody = body;
          notifObj.summaryText = 'Octoleven Couple PAP';
        }
        await LocalNotifications.schedule({
          notifications: [notifObj]
        });
      }
    } catch (e) {
      console.warn('LocalNotifications schedule error:', e);
    }
  }

  // 2. Web Browser Notification
  if ('Notification' in window && Notification.permission === 'granted') {
    try {
      new Notification(title, {
        body: body,
        icon: 'icon-192.png',
        badge: 'favicon.png'
      });
    } catch (e) {}
  }
}

async function handleAuthSession(session) {
  if (!session || !session.user) return;
  currentUser = session.user;
  
  const loginScreen = document.getElementById('loginScreen');
  const mainApp = document.getElementById('mainAppContent');

  // Immediately display Main App and hide Login Screen
  if (loginScreen) {
    loginScreen.classList.add('hidden');
    loginScreen.classList.remove('flex');
  }
  if (mainApp) {
    mainApp.classList.remove('hidden');
    mainApp.classList.add('flex');
  }

  // Render UI immediately from cached/default data so user is never stuck
  try {
    updateUIForActiveUser();
    renderHomeView();
    renderFeed(currentFilter);
    checkFlameReminderOnAppOpen();
  } catch (renderErr) {
    console.warn('Initial render notice:', renderErr);
  }

  // Background sync with Supabase
  try {
    await ensureWorkspaceForUser(currentUser);
    initSupabaseRealtime();
    updateUIForActiveUser();
    renderHomeView();
    renderFeed(currentFilter);
  } catch (err) {
    console.warn('Background workspace sync notice:', err);
  }

  // Background Push Notifications initialization
  try {
    if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.PushNotifications) {
      const PushNotifications = window.Capacitor.Plugins.PushNotifications;
      let permStatus = await PushNotifications.checkPermissions();
      if (permStatus.receive === 'prompt') {
        permStatus = await PushNotifications.requestPermissions();
      }
      if (permStatus.receive === 'granted') {
        await PushNotifications.register();
        
        PushNotifications.addListener('registration', (token) => {
          console.log('Push registration success, token: ' + token.value);
          const supabase = getSupabase();
          if (supabase && currentUser) {
            supabase.from('members').update({ fcm_token: token.value }).eq('id', currentUser.id);
          }
        });

        PushNotifications.addListener('pushNotificationReceived', (notification) => {
          showToast(notification.title || 'Notifikasi Baru', 'notifications');
        });
      }
    }
  } catch (pushErr) {
    console.warn('Push notif check notice:', pushErr);
  }
}

// --- Permanent One-Time Authentication & Session Gating ---
function initSupabaseAuth() {
  if (supabaseAuthInitialized) return;
  supabaseAuthInitialized = true;

  const loginScreen = document.getElementById('loginScreen');
  const mainApp = document.getElementById('mainAppContent');

  const savedUser = localStorage.getItem('octo_permanent_user');
  if (savedUser) {
    try {
      currentUser = JSON.parse(savedUser);
      if (currentUser && currentUser.id) {
        coupleData.activeUser = currentUser.id;
        handleAuthSession({ user: currentUser });
        return;
      }
    } catch(e) {
      console.warn('Error parsing saved session:', e);
    }
  }

  // Fresh installation: show one-time login screen
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

window.handleLoginSubmit = function() {
  const userEl = document.getElementById('authUsernameInput');
  const passEl = document.getElementById('authPasswordInput');

  const rawUsername = userEl?.value || '';
  const username = rawUsername.trim().toLowerCase();
  const password = (passEl?.value || '').trim();

  if (!username) {
    showToast('Masukkan Username atau Nama kamu!', 'warning');
    vibrate(40);
    return;
  }

  let user = null;
  // Rio Account
  if (username.includes('rio') || username.includes('refki') || username.includes('maulana') || username === 'rio') {
    user = { 
      id: 'user-rio-123', 
      email: 'rio@octoleven.local', 
      user_metadata: { full_name: 'Rio Refki Maulana' } 
    };
  } 
  // Nindya Account
  else if (username.includes('nindya') || username.includes('nindi') || username.includes('rachmawati') || username.includes('nidia') || username === 'nindya') {
    user = { 
      id: 'user-nindya-123', 
      email: 'nindya@octoleven.local', 
      user_metadata: { full_name: 'Nindya Rachmawati' } 
    };
  } 
  // Custom Name Account
  else {
    const cleanId = 'user-' + username.replace(/[^a-z0-9]/g, '');
    user = { 
      id: cleanId, 
      email: `${cleanId}@octoleven.local`, 
      user_metadata: { full_name: rawUsername.trim() } 
    };
  }

  // Save session permanently to localStorage so user is NEVER prompted to login again
  currentUser = user;
  coupleData.activeUser = user.id;
  localStorage.setItem('octo_permanent_user', JSON.stringify(user));

  playSound('heart');
  vibrate([50, 100, 50]);
  showToast(`Selamat datang ${user.user_metadata.full_name}! ❤️`, 'favorite');

  handleAuthSession({ user: currentUser });
};

window.logoutAccount = function() {
  localStorage.removeItem('octo_permanent_user');
  currentUser = null;

  const loginScreen = document.getElementById('loginScreen');
  const mainApp = document.getElementById('mainAppContent');

  if (loginScreen) {
    loginScreen.classList.remove('hidden');
    loginScreen.classList.add('flex');
    const userEl = document.getElementById('authUsernameInput');
    const passEl = document.getElementById('authPasswordInput');
    if (userEl) userEl.value = '';
    if (passEl) passEl.value = '';
  }
  if (mainApp) {
    mainApp.classList.add('hidden');
    mainApp.classList.remove('flex');
  }

  showToast('Akun berhasil keluar.', 'logout');
};

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

  // Tab Kita Profile Cards (Gambar 2 Layout)
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

  // Days Together & Tanggal Jadian
  const days = calculateDaysTogether();
  const daysTogetherText = document.getElementById('daysTogetherText');
  if (daysTogetherText) {
    daysTogetherText.innerText = `${coupleTitle} • ${days} hari bersama`;
  }

  const daysTogetherCount = document.getElementById('daysTogetherCount');
  if (daysTogetherCount) {
    daysTogetherCount.innerText = `${days} Hari`;
  }

  const anniversaryFormattedDate = document.getElementById('anniversaryFormattedDate');
  if (anniversaryFormattedDate) {
    const startDate = new Date(coupleData.relationshipStartDate || new Date().toISOString());
    const options = { day: 'numeric', month: 'long', year: 'numeric' };
    anniversaryFormattedDate.innerText = startDate.toLocaleDateString('id-ID', options);
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

  // Total PAP count stats
  const statTotalPap = document.getElementById('statTotalPap');
  if (statTotalPap) statTotalPap.innerText = moments.length;
  
  const statTotalPapCount = document.getElementById('statTotalPapCount');
  if (statTotalPapCount) statTotalPapCount.innerText = moments.length;

  // Update Flame Streak UI
  updateStreakUI();

  // Check Anniversary Notification
  checkAnniversaryNotification();

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
    const isVideo = false;

    return `
      <div onclick="switchTab('feed')" class="w-32 h-44 shrink-0 bg-surface neo-border-sm rounded-xl p-2 snap-center relative transform ${rot} polaroid-card cursor-pointer flex flex-col justify-between">
        <div class="w-full h-28 bg-surface-variant rounded-lg flex items-center justify-center overflow-hidden neo-border-sm relative">
          ${isVideo ? `
            <video src="${m.videoUrl || m.video_url || m.image}" autoplay loop muted playsinline class="w-full h-full object-cover pointer-events-none"></video>
            <span class="absolute top-1 right-1 bg-black/70 text-white text-[9px] font-bold px-1.5 py-0.5 rounded neo-border-sm">🎥 10s</span>
          ` : `
            <img src="${m.image}" alt="PAP thumbnail" class="w-full h-full object-cover"/>
          `}
        </div>
        <div class="flex justify-between items-center mt-1">
          <span class="text-[10px] font-bold text-on-surface-variant line-clamp-1">${senderName}</span>
          <span class="text-[10px] font-bold text-primary flex items-center gap-0.5">
            ❤️ ${heartCount}
          </span>
        </div>
        <span class="absolute -bottom-2 -right-1 bg-secondary-container text-on-secondary-container font-caption text-[10px] font-bold px-2 py-0.5 rounded-full neo-border-sm shadow-sm">
          ${m.sticker || (isVideo ? 'Video 🎥' : 'PAP 📸')}
        </span>
      </div>
    `;
  }).join('');
}

// Helper to toggle sound on feed video cards
function toggleFeedVideoSound(videoEl, btnEl) {
  if (!videoEl) return;
  videoEl.muted = !videoEl.muted;
  const icon = btnEl?.querySelector('.material-symbols-outlined') || btnEl;
  if (icon) {
    icon.innerText = videoEl.muted ? 'volume_off' : 'volume_up';
  }
  vibrate(20);
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
        <p class="text-xs text-on-surface-variant">Kirimkan PAP foto atau video 10 detik pertama kamu untuk pacar tersayang!</p>
        <button onclick="openPapModal()" class="px-4 py-2 bg-primary-container text-white rounded-xl neo-border-sm text-xs font-bold neo-shadow-sm active-press">
          + Kirim PAP Foto / Video
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
    const isVideo = false;

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
            ${moment.sticker || (isVideo ? 'Video 🎥' : 'PAP ✨')}
          </span>
        </div>

        <div class="w-full rounded-xl neo-border overflow-hidden bg-surface-dim relative group aspect-[4/3]">
          ${isVideo ? `
            <video src="${moment.videoUrl || moment.video_url || moment.image}" autoplay loop muted playsinline class="w-full h-full object-cover"></video>
            <div class="absolute top-2.5 right-2.5 flex gap-1.5 items-center z-10">
              <span class="bg-black/70 backdrop-blur-sm text-white text-[10px] font-bold px-2.5 py-1 rounded-full neo-border-sm flex items-center gap-1 shadow">
                <span>🎥</span> 10s
              </span>
              <button onclick="toggleFeedVideoSound(this.parentElement.previousElementSibling, this)" class="w-7 h-7 rounded-full bg-black/70 text-white flex items-center justify-center text-xs neo-border-sm shadow" title="Suara">
                <span class="material-symbols-outlined text-xs">volume_off</span>
              </button>
            </div>
          ` : `
            <img src="${moment.image}" alt="PAP Photo" class="w-full h-full object-cover"/>
          `}
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

let selectedWidgetCategory = 'all'; // 'all', 'partner', 'me'

// --- Simulated Android Widget Sync ---
function updateSimulatedWidget() {
  const dynamicContainer = document.getElementById('widgetDynamicContent');
  const clockEl = document.getElementById('androidClock');

  const now = new Date();
  if (clockEl) {
    clockEl.innerText = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  }

  if (!dynamicContainer) return;

  // Filter moments based on selected widget category
  let displayMoments = moments;
  const activeUser = coupleData.users[coupleData.activeUser] || { id: currentUser?.id, name: 'Kamu' };
  const partnerUser = Object.values(coupleData.users).find((user) => user.id !== activeUser.id);

  if (selectedWidgetCategory === 'partner' && partnerUser) {
    displayMoments = moments.filter(m => m.senderId === partnerUser.id || (m.senderName && !m.senderName.toLowerCase().includes('kamu')));
  } else if (selectedWidgetCategory === 'me') {
    displayMoments = moments.filter(m => m.senderId === activeUser.id || (m.senderName && m.senderName.toLowerCase().includes('kamu')));
  }

  if (displayMoments.length === 0) {
    displayMoments = moments; // Fallback to all if category empty
  }

  if (displayMoments.length === 0) {
    dynamicContainer.innerHTML = `<div class="w-full h-full flex items-center justify-center text-xs text-on-surface-variant font-bold p-5 text-center">Belum ada PAP untuk kategori ini. Ayo kirim PAP!</div>`;
    return;
  }
  const latestMoment = displayMoments[0];
  const senderName = latestMoment.senderName || 'Pasangan';
  const daysTogether = calculateDaysTogether() + ' Hari';

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
  } else if (widgetSize === 'full') {
    dynamicContainer.innerHTML = `
      <div class="relative rounded-xl overflow-hidden neo-border-sm bg-surface-dim aspect-[16/9] w-full">
        <img src="${latestMoment.image}" alt="PAP Widget Full" class="w-full h-full object-cover"/>
        <div class="absolute top-2 left-2">
          <span class="bg-secondary-container text-on-secondary-container text-[9px] font-extrabold px-2 py-0.5 rounded neo-border-sm shadow-sm">
            ${latestMoment.sticker || 'PAP Spesial ✨'}
          </span>
        </div>
        <div class="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-2 text-white flex flex-col justify-end">
          <div class="flex justify-between items-center text-[10px] font-bold text-[#fed74c]">
            <span>${senderName} ❤️</span>
            <span class="text-[9px] text-white/80 font-normal">${formatTimeAgo(latestMoment.timestamp)}</span>
          </div>
          <p class="text-xs font-bold line-clamp-1 mt-0.5">"${latestMoment.caption}"</p>
        </div>
      </div>
    `;
  } else if (widgetSize === 'square') {
    dynamicContainer.innerHTML = `
      <div class="space-y-1 max-w-[170px] mx-auto">
        <div class="relative rounded-xl overflow-hidden neo-border-sm bg-surface-dim aspect-square">
          <img src="${latestMoment.image}" alt="PAP Widget Square" class="w-full h-full object-cover"/>
          <span class="absolute top-1.5 left-1.5 bg-primary-container text-white text-[8px] font-bold px-1.5 py-0.5 rounded neo-border-sm shadow-sm">
            ${latestMoment.sticker || 'PAP ✨'}
          </span>
          <div class="absolute inset-x-0 bottom-0 bg-black/70 p-1.5 text-white">
            <span class="text-[9px] font-bold text-[#fed74c] block">${senderName} ❤️</span>
            <p class="text-[9px] line-clamp-1 leading-tight text-white/90">"${latestMoment.caption}"</p>
          </div>
        </div>
      </div>
    `;
  } else if (widgetSize === 'polaroid') {
    dynamicContainer.innerHTML = `
      <div class="max-w-[190px] mx-auto bg-white p-2.5 rounded-xl neo-border-sm shadow-md flex flex-col items-center gap-1.5 transform rotate-[-1deg]">
        <div class="relative rounded-lg overflow-hidden neo-border-sm bg-gray-100 aspect-square w-full">
          <img src="${latestMoment.image}" alt="PAP Polaroid" class="w-full h-full object-cover"/>
          <span class="absolute top-1.5 left-1.5 bg-secondary-container text-on-secondary-container text-[8px] font-bold px-1.5 py-0.5 rounded neo-border-sm">
            ${latestMoment.sticker || 'Manis ✨'}
          </span>
        </div>
        <div class="text-center w-full pt-1">
          <p class="text-[11px] font-bold italic text-on-background line-clamp-1">"${latestMoment.caption}"</p>
          <span class="text-[9px] font-bold text-primary block mt-0.5">${senderName} • ${formatTimeAgo(latestMoment.timestamp)}</span>
        </div>
      </div>
    `;
  } else if (widgetSize === 'kangen') {
    dynamicContainer.innerHTML = `
      <div class="max-w-[190px] mx-auto bg-surface p-2.5 rounded-2xl neo-border-sm space-y-2">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-1.5">
            <img src="${latestMoment.image}" alt="Avatar" class="w-7 h-7 rounded-full object-cover neo-border-sm"/>
            <div>
              <span class="text-[10px] font-bold text-on-background block leading-tight">${senderName}</span>
              <span class="text-[8px] text-on-surface-variant">${formatTimeAgo(latestMoment.timestamp)}</span>
            </div>
          </div>
          <span class="text-base animate-bounce">🥰</span>
        </div>
        <div class="bg-primary/10 rounded-xl p-2 text-center neo-border-sm">
          <span class="text-[9px] font-bold text-primary uppercase block">Panggilan Rindu</span>
          <span class="text-base font-extrabold text-primary">❤️ Kangen Banget!</span>
        </div>
        <button onclick="event.stopPropagation(); sendLovePoke()" class="w-full py-1.5 bg-primary-container text-white rounded-lg neo-border-sm text-[10px] font-bold active-press flex items-center justify-center gap-1">
          <span>🥺</span> Balas Rindu
        </button>
      </div>
    `;
  } else if (widgetSize === 'countdown') {
    dynamicContainer.innerHTML = `
      <div class="flex items-stretch gap-2.5 w-full bg-surface p-2 rounded-2xl neo-border-sm">
        <div class="w-[45%] aspect-square rounded-xl overflow-hidden neo-border-sm bg-surface-dim relative shrink-0">
          <img src="${latestMoment.image}" alt="Couple" class="w-full h-full object-cover"/>
          <span class="absolute top-1 left-1 bg-secondary-container text-on-secondary-container text-[8px] font-bold px-1.5 py-0.5 rounded neo-border-sm">
            Together 💕
          </span>
        </div>
        <div class="w-[55%] flex flex-col justify-center py-1">
          <span class="text-[10px] font-bold text-primary">Kisah Cinta Kita ❤️</span>
          <span class="text-xl font-black text-on-background leading-tight">${daysTogether}</span>
          <p class="text-[10px] font-semibold text-on-surface-variant line-clamp-1 mt-1">"${latestMoment.caption}"</p>
          <span class="text-[9px] font-bold text-secondary mt-1">✨ Buka Octoleven</span>
        </div>
      </div>
    `;
  }

  // --- NATIVE ANDROID WIDGET SYNC ---
  if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.WidgetPlugin) {
    if (latestMoment && latestMoment.image) {
      window.Capacitor.Plugins.WidgetPlugin.updateWidget({ 
        imageUrl: latestMoment.image, 
        sender: selectedWidgetCategory,
        senderName: senderName,
        caption: latestMoment.caption || '',
        timeText: formatTimeAgo(latestMoment.timestamp),
        tagText: latestMoment.sticker || 'PAP ✨',
        daysCount: daysTogether
      })
        .then(() => console.log('Native Android Widget updated successfully!'))
        .catch(err => console.error('Failed to update Native Widget:', err));
    }
  }
}

function setWidgetCategory(cat) {
  selectedWidgetCategory = cat;
  
  const btnAll = document.getElementById('btnCatAll');
  const btnPartner = document.getElementById('btnCatPartner');
  const btnMe = document.getElementById('btnCatMe');
  const label = document.getElementById('widgetCategoryLabel');

  const activeClass = 'widget-cat-btn py-1.5 px-2 rounded-xl neo-border-sm text-xs font-bold bg-secondary-container text-on-secondary-container active-press transition-all';
  const inactiveClass = 'widget-cat-btn py-1.5 px-2 rounded-xl neo-border-sm text-xs font-bold bg-surface text-on-surface-variant hover:bg-secondary-container active-press transition-all';

  if (btnAll) btnAll.className = cat === 'all' ? activeClass : inactiveClass;
  if (btnPartner) btnPartner.className = cat === 'partner' ? activeClass : inactiveClass;
  if (btnMe) btnMe.className = cat === 'me' ? activeClass : inactiveClass;

  if (label) {
    if (cat === 'partner') label.innerText = 'Pasangan Saja';
    else if (cat === 'me') label.innerText = 'Saya Saja';
    else label.innerText = 'Semua PAP';
  }

  if (window.Capacitor?.Plugins?.WidgetPlugin) {
    window.Capacitor.Plugins.WidgetPlugin.setWidgetCategory({ category: cat }).catch(() => {});
  }

  vibrate(25);
  updateSimulatedWidget();
}

function setWidgetSize(size) {
  widgetSize = size;
  const container = document.getElementById('simulatedWidgetContainer');
  
  const buttons = {
    landscape: document.getElementById('btnWidgetLandscape'),
    full: document.getElementById('btnWidgetFull'),
    square: document.getElementById('btnWidgetSquare'),
    polaroid: document.getElementById('btnWidgetPolaroid'),
    kangen: document.getElementById('btnWidgetKangen'),
    countdown: document.getElementById('btnWidgetCountdown')
  };

  const activeBtnClass = 'py-2 px-1.5 rounded-xl neo-border-sm font-label-bold text-[11px] bg-secondary-container text-on-secondary-container active-press text-center';
  const inactiveBtnClass = 'py-2 px-1.5 rounded-xl neo-border-sm font-label-bold text-[11px] bg-surface text-on-surface-variant active-press text-center';

  for (const [key, btn] of Object.entries(buttons)) {
    if (btn) btn.className = key === size ? activeBtnClass : inactiveBtnClass;
  }

  const pinText = document.getElementById('pinWidgetBtnText');
  const sizeNames = {
    landscape: '4x2 Memanjang',
    full: '4x2 Full Frame',
    square: '2x2 Kotak',
    polaroid: '2x2 Polaroid',
    kangen: '2x2 Kangen Counter',
    countdown: '4x2 Hari Jadian'
  };
  if (pinText) {
    pinText.innerText = `Pasang Widget ${sizeNames[size] || size} ke Home Screen`;
  }

  if (size === 'square' || size === 'polaroid' || size === 'kangen') {
    if (container) container.className = 'octo-widget bg-surface rounded-2xl p-2.5 relative cursor-pointer max-w-[200px] mx-auto transition-all';
  } else {
    if (container) container.className = 'octo-widget bg-surface rounded-2xl p-2.5 relative cursor-pointer w-full transition-all';
  }

  vibrate(20);
  updateSimulatedWidget();
}

// --- Sticker Badges Category Filter ---
function filterStickerCategory(cat) {
  const pills = document.querySelectorAll('#stickerPillsContainer .sticker-btn');
  pills.forEach(pill => {
    const pillCat = pill.getAttribute('data-cat');
    if (cat === 'all' || pillCat === cat) {
      pill.style.display = 'inline-block';
    } else {
      pill.style.display = 'none';
    }
  });

  const links = {
    all: document.getElementById('stkCatAll'),
    santai: document.getElementById('stkCatSantai'),
    luar: document.getElementById('stkCatLuar'),
    spesial: document.getElementById('stkCatSpesial')
  };

  for (const [key, link] of Object.entries(links)) {
    if (link) {
      link.className = key === cat ? 'text-primary underline font-bold' : 'text-on-surface-variant font-bold';
    }
  }
}

function triggerWidgetQuickReaction() {
  playSound('heart');
  vibrate(50);
  triggerHeartBurst(window.innerWidth / 2, window.innerHeight / 2);
  showToast('Reaksi ❤️ dikirim dari Widget ke HP Pasangan!', 'favorite');
  
  if (moments.length > 0) {
    handleFeedReaction(moments[0].id, '❤️', null);
  }
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
  showToast('Mengompres & mengunggah foto... 🚀', 'cloud_upload');

  // Smart client-side compression before upload (max 1280px, quality 0.85)
  let fileSource = currentMediaFile || currentCapturedImage;
  let compressedResult = await compressImage(fileSource, 1280, 1280, 0.85);
  let publicPhotoUrl = compressedResult.dataUrl || currentCapturedImage;

  if (isSupabaseReady() && currentUser) {
    const supabase = getSupabase();
    try {
      let fileToUpload = compressedResult.blob;
      if (!fileToUpload && publicPhotoUrl?.startsWith('data:')) {
        fileToUpload = dataURItoBlob(publicPhotoUrl);
      }

      if (fileToUpload) {
        const fileExt = 'jpg';
        const fileName = `${coupleData.id}/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;

        // Upload to bucket 'pap-photos'
        const { error: uploadError } = await supabase.storage
          .from('pap-photos')
          .upload(fileName, fileToUpload, {
            contentType: 'image/jpeg',
            upsert: true
          });

        if (!uploadError) {
          const { data: publicUrlData } = supabase.storage
            .from('pap-photos')
            .getPublicUrl(fileName);
          if (publicUrlData && publicUrlData.publicUrl) {
            publicPhotoUrl = publicUrlData.publicUrl;
          }
        } else {
          console.warn('Gagal unggah ke Supabase Storage, menggunakan foto lokal terkompresi:', uploadError.message);
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

      triggerConfetti();
      showToast('PAP terkirim dan tersinkron! 💖', 'check_circle');
      
      // Kirim Push Notification dengan payload lengkap dan widget update
      sendPushNotification('PAP Baru Masuk! 📸', `${activeUser.name} ngirim PAP spesial nih, yuk intip!`, { 
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
      console.warn('Supabase Error saat unggah PAP:', err.message);
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
  triggerConfetti();
  showToast('PAP tersimpan di perangkat! 💖', 'check_circle');

  triggerHeartBurst(window.innerWidth / 2, window.innerHeight / 2);
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
  const activeUser = coupleData.users[currentKey] || { id: currentUser?.id, name: 'Kamu' };
  activeUser.moodEmoji = emoji;
  activeUser.moodText = text;
  saveData();

  closeMoodPickerModal();
  playSound('toast');
  vibrate(30);
  triggerHeartBurst(window.innerWidth / 2, window.innerHeight / 2);
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

    // Kirim Push Notification update mood
    sendPushNotification('Mood Pasangan Diperbarui ✨', `${activeUser.name} sekarang lagi ${emoji} ${text}`, {
      event: 'mood',
      senderName: activeUser.name,
      tagText: emoji,
      caption: text
    });
  }
}

// --- Love Poke Action ---
async function sendLovePoke() {
  const activeUser = coupleData.users[coupleData.activeUser] || { name: 'Pasangan' };
  const partner = Object.values(coupleData.users).find((user) => user.id !== activeUser?.id);
  const partnerName = partner?.name || 'pasanganmu';

  playSound('heart');
  vibrate([50, 50, 50]);
  triggerHeartBurst(window.innerWidth / 2, window.innerHeight / 2);
  showToast(`Love poke terkirim ke ${partnerName}! 💖 "Aku kangen kamu!"`, 'favorite');

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

  // Kirim ke backend FCM untuk Push Notification
  sendPushNotification('Panggilan Rindu! 🥺❤️', `${activeUser.name} lagi kangen banget sama kamu!`, { 
    event: 'kangen',
    senderName: activeUser.name,
    tagText: 'Rindu 🥺'
  });
}

// --- Push Notification Helper (FCM & Realtime Broadcast Handler) ---
async function sendPushNotification(title, body, data = {}) {
  if (!isSupabaseReady() || !currentUser) return;
  try {
    const supabase = getSupabase();
    
    // 1. Broadcast via Realtime channel
    if (supabaseRealtimeChannel) {
      try {
        supabaseRealtimeChannel.send({
          type: 'broadcast',
          event: data.event || 'notification',
          payload: {
            senderId: currentUser.id,
            senderName: coupleData.users[currentUser.id]?.name || 'Pasangan',
            title,
            body,
            ...data
          }
        });
      } catch (bcErr) {
        console.warn('Realtime broadcast error:', bcErr);
      }
    }

    // 2. Ambil token pasangan dari Supabase (filter by couple_id)
    const { data: members, error } = await supabase
      .from('members')
      .select('fcm_token, name')
      .eq('couple_id', coupleData.id)
      .neq('id', currentUser.id)
      .not('fcm_token', 'is', null);
        
    if (error || !members || members.length === 0 || !members[0]?.fcm_token) {
      console.log('Token FCM pasangan belum terdaftar di database.');
      return;
    }
    
    const partnerToken = members[0].fcm_token;
    const payload = {
      token: partnerToken,
      title: title,
      body: body,
      data: {
        ...data,
        title,
        body,
        widget_update: 'true'
      }
    };

    // Kirim via endpoint Vercel production & fallback lokal
    try {
      await fetch('https://octoleven.vercel.app/api/fcm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      console.log('Push notification berhasil dikirim ke pasangan via FCM!');
    } catch (vercelErr) {
      try {
        await fetch('/api/fcm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      } catch (localErr) {
        console.warn('FCM dispatch failed:', localErr);
      }
    }
  } catch (err) {
    console.error('Push notification dispatch error:', err);
  }
}

// Request & Register Push Notification Permissions (Android Native & Web)
async function requestPushPermissionsAndRegister() {
  showToast('Memeriksa & meminta izin notifikasi...', 'notifications');
  vibrate(30);

  let nativePushGranted = false;
  let localNotifGranted = false;

  // 1. Android Capacitor Push Notifications
  if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.PushNotifications) {
    try {
      const PushNotifications = window.Capacitor.Plugins.PushNotifications;
      let perm = await PushNotifications.checkPermissions();
      if (perm.receive !== 'granted') {
        perm = await PushNotifications.requestPermissions();
      }
      if (perm.receive === 'granted') {
        nativePushGranted = true;
        await PushNotifications.register();
      }
    } catch (e) {
      console.warn('PushNotifications error:', e);
    }
  }

  // 2. Android Capacitor Local Notifications
  if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.LocalNotifications) {
    try {
      const LocalNotifications = window.Capacitor.Plugins.LocalNotifications;
      let localPerm = await LocalNotifications.checkPermissions();
      if (localPerm.display !== 'granted') {
        localPerm = await LocalNotifications.requestPermissions();
      }
      if (localPerm.display === 'granted') {
        localNotifGranted = true;
      }
    } catch (e) {
      console.warn('LocalNotifications error:', e);
    }
  }

  // 3. Web Notification API
  if ('Notification' in window) {
    try {
      if (Notification.permission !== 'granted' && Notification.permission !== 'denied') {
        await Notification.requestPermission();
      }
    } catch(e) {}
  }

  // Update Status Badge di UI
  const badge = document.getElementById('fcmStatusBadge');
  if (badge) {
    badge.innerText = 'Aktif ✅';
    badge.className = 'text-[10px] font-bold px-2 py-0.2 rounded-full neo-border-sm bg-green-100 text-green-800';
  }

  showToast('Izin notifikasi pasangan aktif! 🔔', 'notifications');
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

// --- API STREAK (FLAME STREAK) SYSTEM ---
function calculateFlameStreak() {
  const activeUser = coupleData.users[coupleData.activeUser] || { id: coupleData.activeUser || 'local-user', name: 'Kamu' };
  const partnerUser = Object.values(coupleData.users).find((user) => user.id !== activeUser.id) || { id: 'partner', name: 'Pasangan' };

  const todayStr = new Date().toISOString().split('T')[0];
  
  // Group moments by YYYY-MM-DD
  const momentsByDate = {};
  moments.forEach((m) => {
    const dStr = (m.createdAt ? new Date(m.createdAt) : new Date()).toISOString().split('T')[0];
    if (!momentsByDate[dStr]) {
      momentsByDate[dStr] = { me: 0, partner: 0 };
    }
    if (m.senderId === activeUser.id || m.senderName === activeUser.name) {
      momentsByDate[dStr].me++;
    } else {
      momentsByDate[dStr].partner++;
    }
  });

  const meSentToday = (momentsByDate[todayStr]?.me || 0) > 0;
  const partnerSentToday = (momentsByDate[todayStr]?.partner || 0) > 0;
  const bothSentToday = meSentToday && partnerSentToday;

  let streak = 0;
  let checkDate = new Date();

  // If both sent today, include today in streak
  if (bothSentToday) {
    streak++;
    checkDate.setDate(checkDate.getDate() - 1);
  } else {
    // If not both sent today yet, count from yesterday backwards
    checkDate.setDate(checkDate.getDate() - 1);
  }

  while (true) {
    const dStr = checkDate.toISOString().split('T')[0];
    const dayData = momentsByDate[dStr];
    if (dayData && dayData.me > 0 && dayData.partner > 0) {
      streak++;
      checkDate.setDate(checkDate.getDate() - 1);
    } else {
      break;
    }
  }

  let todayStatus = 'extinguished';
  if (bothSentToday) {
    todayStatus = 'active';
  } else if (meSentToday || partnerSentToday) {
    todayStatus = 'pending';
  } else {
    todayStatus = 'extinguished';
  }

  return {
    streakCount: streak,
    todayStatus,
    meSentToday,
    partnerSentToday,
    bothSentToday
  };
}

function updateStreakUI() {
  const streak = calculateFlameStreak();
  
  // Header Badge
  const headerStreakIcon = document.getElementById('headerStreakIcon');
  const headerStreakCount = document.getElementById('headerStreakCount');
  if (headerStreakIcon && headerStreakCount) {
    headerStreakCount.innerText = streak.streakCount;
    if (streak.todayStatus === 'active') {
      headerStreakIcon.innerText = '🔥';
      headerStreakIcon.className = 'text-xl flame-active inline-block';
    } else if (streak.todayStatus === 'pending') {
      headerStreakIcon.innerText = '⏳';
      headerStreakIcon.className = 'text-xl inline-block';
    } else {
      headerStreakIcon.innerText = '💨';
      headerStreakIcon.className = 'text-xl inline-block';
    }
  }

  // Beranda Banner
  const homeStreakTitle = document.getElementById('homeStreakTitle');
  const homeStreakBadge = document.getElementById('homeStreakBadge');
  const homeStreakSubtitle = document.getElementById('homeStreakSubtitle');
  const homeStreakFlameIcon = document.getElementById('homeStreakFlameIcon');
  if (homeStreakTitle && homeStreakBadge && homeStreakSubtitle) {
    homeStreakTitle.innerText = `Api Streak: ${streak.streakCount} Hari`;
    if (streak.todayStatus === 'active') {
      homeStreakBadge.innerText = '🔥 Menyala';
      homeStreakBadge.className = 'text-[9px] font-extrabold px-2 py-0.5 rounded-full bg-orange-500 text-white neo-border-sm';
      homeStreakSubtitle.innerText = 'Kalian berdua sudah kirim PAP hari ini! Pertahankan streak!';
      if (homeStreakFlameIcon) {
        homeStreakFlameIcon.innerText = '🔥';
        homeStreakFlameIcon.className = 'w-10 h-10 rounded-xl bg-orange-500 text-white flex items-center justify-center neo-border-sm text-2xl flame-active shadow-sm';
      }
    } else if (streak.todayStatus === 'pending') {
      homeStreakBadge.innerText = '⏳ Menunggu Pasangan';
      homeStreakBadge.className = 'text-[9px] font-extrabold px-2 py-0.5 rounded-full bg-amber-200 text-amber-900 neo-border-sm';
      homeStreakSubtitle.innerText = streak.meSentToday ? 'Kamu sudah PAP! Menunggu giliran pasangan.' : 'Pasangan sudah PAP! Yuk kirim PAP giliranmu!';
      if (homeStreakFlameIcon) {
        homeStreakFlameIcon.innerText = '🔥';
        homeStreakFlameIcon.className = 'w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center neo-border-sm text-2xl shadow-sm';
      }
    } else {
      homeStreakBadge.innerText = '💨 Belum Hidup';
      homeStreakBadge.className = 'text-[9px] font-extrabold px-2 py-0.5 rounded-full bg-slate-200 text-slate-800 neo-border-sm';
      homeStreakSubtitle.innerText = 'Kirim PAP hari ini untuk mengaktifkan apinya!';
      if (homeStreakFlameIcon) {
        homeStreakFlameIcon.innerText = '💨';
        homeStreakFlameIcon.className = 'w-10 h-10 rounded-xl bg-slate-400 text-white flex items-center justify-center neo-border-sm text-2xl shadow-sm';
      }
    }
  }

  // Tab Kita Streak Card
  const kitaStreakDayText = document.getElementById('kitaStreakDayText');
  const kitaStreakStatusPill = document.getElementById('kitaStreakStatusPill');
  const kitaStreakIconContainer = document.getElementById('kitaStreakIconContainer');
  if (kitaStreakDayText && kitaStreakStatusPill) {
    kitaStreakDayText.innerText = `Api Streak: ${streak.streakCount} Hari`;
    if (streak.todayStatus === 'active') {
      kitaStreakStatusPill.innerText = '🔥 Menyala';
      kitaStreakStatusPill.className = 'text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-orange-500 text-white neo-border-sm';
      if (kitaStreakIconContainer) kitaStreakIconContainer.className = 'w-10 h-10 rounded-xl bg-orange-500 text-white flex items-center justify-center neo-border-sm text-xl flame-active shadow-sm';
    } else if (streak.todayStatus === 'pending') {
      kitaStreakStatusPill.innerText = '⏳ Menunggu Pasangan';
      kitaStreakStatusPill.className = 'text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-amber-200 text-amber-900 neo-border-sm';
      if (kitaStreakIconContainer) kitaStreakIconContainer.className = 'w-10 h-10 rounded-xl bg-amber-400 text-white flex items-center justify-center neo-border-sm text-xl shadow-sm';
    } else {
      kitaStreakStatusPill.innerText = '💨 Belum Hidup';
      kitaStreakStatusPill.className = 'text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-slate-200 text-slate-800 neo-border-sm';
      if (kitaStreakIconContainer) kitaStreakIconContainer.className = 'w-10 h-10 rounded-xl bg-slate-400 text-white flex items-center justify-center neo-border-sm text-xl shadow-sm';
    }
  }

  // Flame Reminder Modal status labels
  const flameStatusMeText = document.getElementById('flameStatusMeText');
  const flameStatusMeBadge = document.getElementById('flameStatusMeBadge');
  const flameStatusPartnerText = document.getElementById('flameStatusPartnerText');
  const flameStatusPartnerBadge = document.getElementById('flameStatusPartnerBadge');
  if (flameStatusMeText && flameStatusPartnerText) {
    if (streak.meSentToday) {
      flameStatusMeText.innerText = 'Sudah PAP ✅';
      flameStatusMeText.className = 'text-emerald-600 font-bold';
      if (flameStatusMeBadge) {
        flameStatusMeBadge.innerText = '1/1 PAP';
        flameStatusMeBadge.className = 'text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-bold';
      }
    } else {
      flameStatusMeText.innerText = 'Belum PAP ❌';
      flameStatusMeText.className = 'text-red-600 font-bold';
      if (flameStatusMeBadge) {
        flameStatusMeBadge.innerText = '0/1 PAP';
        flameStatusMeBadge.className = 'text-[10px] bg-red-100 text-red-800 px-2 py-0.5 rounded-full font-bold';
      }
    }

    if (streak.partnerSentToday) {
      flameStatusPartnerText.innerText = 'Sudah PAP ✅';
      flameStatusPartnerText.className = 'text-emerald-600 font-bold';
      if (flameStatusPartnerBadge) {
        flameStatusPartnerBadge.innerText = '1/1 PAP';
        flameStatusPartnerBadge.className = 'text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-bold';
      }
    } else {
      flameStatusPartnerText.innerText = 'Belum PAP ❌';
      flameStatusPartnerText.className = 'text-red-600 font-bold';
      if (flameStatusPartnerBadge) {
        flameStatusPartnerBadge.innerText = '0/1 PAP';
        flameStatusPartnerBadge.className = 'text-[10px] bg-red-100 text-red-800 px-2 py-0.5 rounded-full font-bold';
      }
    }
  }

  // Streak Info Modal
  const streakModalFlameIcon = document.getElementById('streakModalFlameIcon');
  const streakModalStreakCount = document.getElementById('streakModalStreakCount');
  const streakModalStatusText = document.getElementById('streakModalStatusText');
  if (streakModalStreakCount && streakModalStatusText) {
    streakModalStreakCount.innerText = `${streak.streakCount} Hari Streak`;
    if (streak.todayStatus === 'active') {
      streakModalStatusText.innerText = '🔥 Api Berkobar! Kedua pasangan sudah PAP hari ini.';
      streakModalStatusText.className = 'text-xs text-orange-600 font-bold';
    } else if (streak.todayStatus === 'pending') {
      streakModalStatusText.innerText = '⏳ Api Sedang Menunggu! 1 pasangan belum PAP.';
      streakModalStatusText.className = 'text-xs text-amber-600 font-bold';
    } else {
      streakModalStatusText.innerText = '💨 Api Padam! Belum ada yang kirim PAP hari ini.';
      streakModalStatusText.className = 'text-xs text-slate-600 font-bold';
    }
  }
}

// Extinguished Flame Reminder Check on Session Open
function checkFlameReminderOnAppOpen() {
  const dismissed = sessionStorage.getItem('flame_reminder_dismissed');
  if (dismissed) return;

  const streak = calculateFlameStreak();
  if (streak.todayStatus !== 'active') {
    // Show extinguished flame prompt
    setTimeout(() => {
      const modal = document.getElementById('flameReminderModal');
      if (modal) {
        modal.classList.remove('hidden');
        modal.classList.add('flex');
        vibrate(30);
      }
    }, 900);
  }
}

function closeFlameReminderModal() {
  sessionStorage.setItem('flame_reminder_dismissed', 'true');
  const modal = document.getElementById('flameReminderModal');
  if (modal) {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  }
}

function triggerPapFromFlameModal() {
  closeFlameReminderModal();
  openPapModal();
}

function openStreakInfoModal() {
  updateStreakUI();
  const modal = document.getElementById('streakInfoModal');
  if (modal) {
    modal.classList.remove('hidden');
    modal.classList.add('flex');
  }
}

function closeStreakInfoModal() {
  const modal = document.getElementById('streakInfoModal');
  if (modal) {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  }
}

// --- TANGGAL JADIAN & ANNIVERSARY NOTIFICATION ---
function openAnniversaryModal() {
  const modal = document.getElementById('anniversaryModal');
  const dateInput = document.getElementById('anniversaryDateInput');
  if (dateInput) {
    const rawDate = coupleData.relationshipStartDate || new Date().toISOString();
    dateInput.value = rawDate.split('T')[0];
  }
  if (modal) {
    modal.classList.remove('hidden');
    modal.classList.add('flex');
  }
}

function closeAnniversaryModal() {
  const modal = document.getElementById('anniversaryModal');
  if (modal) {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  }
}

async function saveAnniversaryDate() {
  const dateInput = document.getElementById('anniversaryDateInput');
  if (!dateInput || !dateInput.value) {
    showToast('Pilih tanggal jadian terlebih dahulu!', 'calendar_month');
    return;
  }

  const selectedDate = new Date(dateInput.value);
  if (selectedDate > new Date()) {
    showToast('Tanggal jadian tidak boleh di masa depan!', 'error');
    return;
  }

  const isoDate = selectedDate.toISOString();
  coupleData.relationshipStartDate = isoDate;
  saveData();

  // Sync to Supabase
  const supabase = getSupabase();
  if (supabase && coupleData.id) {
    try {
      await supabase.from('couples').update({
        relationship_start_date: isoDate
      }).eq('id', coupleData.id);
    } catch (e) {
      console.warn('Gagal sync tanggal jadian ke Supabase:', e);
    }
  }

  // Update Android widget
  if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.WidgetPlugin) {
    try {
      const daysTogether = calculateDaysTogether() + ' Hari';
      window.Capacitor.Plugins.WidgetPlugin.updateWidget({
        daysCount: daysTogether
      });
    } catch(e) {}
  }

  closeAnniversaryModal();
  updateUIForActiveUser();
  triggerConfetti();
  showToast('Tanggal jadian berhasil diperbarui! 🎉', 'favorite');
}

// Check Mensiversary / Anniversary Notifications
function checkAnniversaryNotification() {
  if (!coupleData.relationshipStartDate) return;

  const startDate = new Date(coupleData.relationshipStartDate);
  const now = new Date();

  // If today is the same date of month (e.g. 11th)
  if (startDate.getDate() === now.getDate()) {
    const lastNotifiedKey = `anniversary_notified_${now.getFullYear()}_${now.getMonth()}`;
    if (!localStorage.getItem(lastNotifiedKey)) {
      localStorage.setItem(lastNotifiedKey, 'true');

      const isYearly = startDate.getMonth() === now.getMonth() && startDate.getFullYear() !== now.getFullYear();
      const yearsDiff = now.getFullYear() - startDate.getFullYear();

      let title = 'Happy Mensiversary! 🎉';
      let body = 'Hari ini adalah tanggal jadian spesial kalian! Selamat ya! ❤️';

      if (isYearly) {
        title = `Happy Anniversary ke-${yearsDiff} Tahun! 🎂`;
        body = `Selamat ulang tahun jadian ke-${yearsDiff} tahun bersama pasangan tercinta! ❤️✨`;
      }

      showToast(title, 'celebration');

      // Send push notification if possible
      sendPushNotification(title, body, { event: 'anniversary' });

      // Native local notification
      if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.LocalNotifications) {
        try {
          window.Capacitor.Plugins.LocalNotifications.schedule({
            notifications: [
              {
                title: title,
                body: body,
                id: 8888,
                schedule: { at: new Date(Date.now() + 1000) }
              }
            ]
          });
        } catch(e) {}
      }
    }
  }
}

// --- PROFILE EDITING (EDIT PROFIL KAMU) ---
let pendingEditAvatar = '';
let pendingAvatarFile = null;

function openEditProfileModal() {
  const activeUser = coupleData.users[coupleData.activeUser] || { name: currentUser?.name || 'Rio', avatar: '' };
  const modal = document.getElementById('profileEditModal');
  const nameInput = document.getElementById('profileNameInput');
  const avatarPreview = document.getElementById('profileEditAvatarPreview');

  pendingAvatarFile = null;
  pendingEditAvatar = activeUser.avatar || `https://api.dicebear.com/7.x/notionists/svg?seed=${activeUser.name}&backgroundColor=ffdfbf`;

  if (nameInput) nameInput.value = activeUser.name;
  if (avatarPreview) avatarPreview.src = pendingEditAvatar;

  if (modal) {
    modal.classList.remove('hidden');
    modal.classList.add('flex');
  }
}

function closeEditProfileModal() {
  const modal = document.getElementById('profileEditModal');
  if (modal) {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  }
}

function setProfileAvatarPreset(seed) {
  pendingAvatarFile = null;
  pendingEditAvatar = `https://api.dicebear.com/7.x/notionists/svg?seed=${seed}&backgroundColor=ffdfbf`;
  const avatarPreview = document.getElementById('profileEditAvatarPreview');
  if (avatarPreview) avatarPreview.src = pendingEditAvatar;
}

async function handleProfileAvatarSelected(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  try {
    showToast('Memproses foto profil...', 'info');
    // Compress and convert to standard JPEG (supports JPG, PNG, HEIC, WEBP, etc.)
    const compressed = await compressImage(file, 640, 640, 0.85);
    if (compressed.dataUrl) {
      pendingEditAvatar = compressed.dataUrl;
      pendingAvatarFile = compressed.blob || (compressed.dataUrl.startsWith('data:') ? dataURItoBlob(compressed.dataUrl) : file);
      const avatarPreview = document.getElementById('profileEditAvatarPreview');
      if (avatarPreview) avatarPreview.src = pendingEditAvatar;
      showToast('Foto profil dipilih! Klik "Simpan Profil". 📸✨', 'check_circle');
    }
  } catch (err) {
    console.error('Gagal memproses foto profil:', err);
    showToast('Gagal memuat format gambar.', 'error');
  }

  // Reset file input value
  event.target.value = '';
}

async function saveProfileChanges() {
  const nameInput = document.getElementById('profileNameInput');
  const newName = nameInput ? nameInput.value.trim() : '';

  if (!newName) {
    showToast('Nama tidak boleh kosong!', 'error');
    return;
  }

  showToast('Menyimpan perubahan profil... ✨', 'info');

  // Upload custom avatar image to Supabase Storage if uploaded from file
  if (pendingAvatarFile && isSupabaseReady() && currentUser) {
    try {
      const supabase = getSupabase();
      const fileName = `${coupleData.id || 'default'}/avatar_${currentUser.id}_${Date.now()}.jpg`;
      const { error: uploadErr } = await supabase.storage
        .from('pap-photos')
        .upload(fileName, pendingAvatarFile, {
          contentType: 'image/jpeg',
          upsert: true
        });
      if (!uploadErr) {
        const { data: pubData } = supabase.storage.from('pap-photos').getPublicUrl(fileName);
        if (pubData?.publicUrl) {
          pendingEditAvatar = pubData.publicUrl;
        }
      }
    } catch (e) {
      console.warn('Storage avatar upload notice:', e);
    }
  }

  if (coupleData.activeUser && coupleData.users[coupleData.activeUser]) {
    coupleData.users[coupleData.activeUser].name = newName;
    if (pendingEditAvatar) coupleData.users[coupleData.activeUser].avatar = pendingEditAvatar;
  }

  saveData();

  // Save to Supabase
  const supabase = getSupabase();
  if (supabase && currentUser) {
    try {
      await supabase.from('members').update({
        name: newName,
        avatar: pendingEditAvatar,
        updated_at: new Date().toISOString()
      }).eq('id', currentUser.id);
    } catch(e) {
      console.warn('Gagal simpan profil ke Supabase:', e);
    }
  }

  closeEditProfileModal();
  updateUIForActiveUser();
  renderHomeView();
  showToast('Profil berhasil diperbarui! ✨', 'check_circle');
}

// --- AGENDA & DEVICE INTERNAL CALENDAR INTEGRATION ---
function exportAgendaToDeviceCalendar(title, dateStr, timeStr, notes = '') {
  if (!title || !dateStr || !timeStr) return;
  
  const startDate = new Date(`${dateStr}T${timeStr}:00`);
  const endDate = new Date(startDate.getTime() + 60 * 60 * 1000); // 1 hour duration

  const formatICSDate = (date) => {
    return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  };

  const gCalUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&dates=${formatICSDate(startDate)}/${formatICSDate(endDate)}&details=${encodeURIComponent(notes || 'Agenda kencan bersama pasangan ❤️ (Octoleven)')}`;

  // Use window.open with _system to prompt Android to open the default browser or Google Calendar app
  if (window.Capacitor && window.Capacitor.Plugins) {
    window.open(gCalUrl, '_system');
  } else {
    window.open(gCalUrl, '_blank');
  }
}

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
  const syncCalendarCheckbox = document.getElementById('agendaSyncDeviceCalendar');

  if (!title || !dateStr || !timeStr) {
    showToast('Mohon lengkapi semua kolom agenda!', 'error');
    return;
  }

  const scheduleDate = new Date(`${dateStr}T${timeStr}:00`);
  if (scheduleDate < new Date()) {
    showToast('Waktu agenda tidak boleh di masa lalu!', 'error');
    return;
  }

  const supabase = getSupabase();

  try {
    // Simpan ke DB members
    if (supabase && currentUser) {
      await supabase
        .from('members')
        .update({
          next_date_label: title,
          next_date_time: scheduleDate.toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', currentUser.id);
    }

    // Set Local Notification via Capacitor jika tersedia
    if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.LocalNotifications) {
      const LocalNotifications = window.Capacitor.Plugins.LocalNotifications;
      
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
      }
    }

    // Integrasi Kalender Internal HP (.ics & Intent)
    if (syncCalendarCheckbox && syncCalendarCheckbox.checked) {
      exportAgendaToDeviceCalendar(title, dateStr, timeStr);
      showToast('Agenda diekspor ke Kalender HP! 📅', 'event_available');
    }

    closeAgendaModal();
    
    // Update Lokal & UI
    if (currentUser && coupleData.users[currentUser.id]) {
      coupleData.users[currentUser.id].nextDateLabel = title;
      coupleData.users[currentUser.id].nextDateTime = scheduleDate.toISOString();
    }
    
    // Kirim notifikasi agenda
    sendPushNotification('Agenda Baru Pasangan! 📅', `${currentUser?.name || 'Pasangan'} akan ${title} pada ${scheduleDate.toLocaleString('id-ID')}`, { event: 'agenda' });

    updateUIForActiveUser();
    
    // Manual Update Text di UI (Bento box)
    const agendaTitleEls = document.querySelectorAll('h4.text-on-tertiary-container');
    agendaTitleEls.forEach(el => {
       if(el.innerText === 'Agenda Terdekat' || el.innerText.includes('Agenda')) {
           el.innerText = title;
           if (el.nextElementSibling) el.nextElementSibling.innerText = scheduleDate.toLocaleString('id-ID');
       }
    });

    triggerConfetti();
    showToast('Agenda berhasil disimpan & disinkronkan!', 'check_circle');
  } catch (error) {
    console.error('Gagal menyimpan agenda:', error);
    showToast('Terjadi kesalahan saat menyimpan agenda.', 'error');
  }
}

// --- Initial Setup on Page Load ---
document.addEventListener('DOMContentLoaded', () => {
  renderHomeView();
  renderFeed('all');
  updateSimulatedWidget();
  updateStickerButtons();
  updateStreakUI();
  checkFlameReminderOnAppOpen();

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
      await window.Capacitor.Plugins.WidgetPlugin.pinWidget({ widgetType: widgetSize });
      triggerConfetti();
      showToast('Berhasil meminta pasang widget ke Home Screen!', 'add_to_home_screen');
    } catch (e) {
      showToast('Gagal: ' + (e.message || ''), 'error');
    }
  } else {
    showToast('Fitur ini hanya tersedia di HP Android.', 'warning');
  }
};

