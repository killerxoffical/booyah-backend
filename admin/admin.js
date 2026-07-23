// Admin Panel Logic — Real-time, Fast, Fixed

const loginScreen = document.getElementById('login-screen');
const appContainer = document.getElementById('app-container');
let currentEditingUserId = null;

// Store all users data for search filtering
let allUsersData = [];

// Active real-time listeners (to unsubscribe when needed)
let usersUnsubscribe = null;
let dashboardUnsubscribe = null;
let monetagRef = null;

// ==========================================
// AUTHENTICATION (PIN & EMAIL SYSTEM)
// ==========================================

const ADMIN_PIN = "5449";

// Check if already logged in via localStorage — instant, no delay
if (localStorage.getItem('booyah_admin_logged_in') === 'true') {
    loginScreen.classList.add('hidden');
    appContainer.classList.remove('hidden');
    
    // Ensure Firebase Auth is actually signed in (in case of page reload)
    firebase.auth().onAuthStateChanged((user) => {
        if (!user) {
            // Silently re-authenticate
            firebase.auth().signInWithEmailAndPassword("admin@booyah.com", "123456").catch(err => {
                console.error("Auto-login failed:", err);
            });
        }
    });

    startRealtimeListeners();
} else {
    loginScreen.classList.remove('hidden');
    appContainer.classList.add('hidden');
}

// Switch between PIN and Email login tabs
window.switchLoginTab = function(tab) {
    const pinTab = document.getElementById('login-tab-pin');
    const emailTab = document.getElementById('login-tab-email');
    const pinFields = document.getElementById('pin-login-fields');
    const emailFields = document.getElementById('email-login-fields');
    
    if (tab === 'pin') {
        pinTab.className = "flex-1 pb-2.5 text-xs font-bold text-booyahYellow border-b-2 border-booyahYellow uppercase tracking-widest";
        emailTab.className = "flex-1 pb-2.5 text-xs font-bold text-gray-500 border-b-2 border-transparent uppercase tracking-widest";
        pinFields.classList.remove('hidden');
        emailFields.classList.add('hidden');
    } else {
        emailTab.className = "flex-1 pb-2.5 text-xs font-bold text-booyahYellow border-b-2 border-booyahYellow uppercase tracking-widest";
        pinTab.className = "flex-1 pb-2.5 text-xs font-bold text-gray-500 border-b-2 border-transparent uppercase tracking-widest";
        emailFields.classList.remove('hidden');
        pinFields.classList.add('hidden');
    }
};

// 1. Authorize using PIN (Silently logs in using admin credentials)
window.authorizeAdmin = async function() {
    const pin = document.getElementById('admin-pin').value;
    const loginBtn = document.getElementById('admin-login-btn');
    
    loginBtn.textContent = 'AUTHORIZING...';
    loginBtn.disabled = true;

    if (pin === ADMIN_PIN) {
        try {
            // Silently login to Firebase Auth to get secure write permissions
            await firebase.auth().signInWithEmailAndPassword("admin@booyah.com", "123456");
            
            localStorage.setItem('booyah_admin_logged_in', 'true');
            document.getElementById('login-screen').classList.add('hidden');
            document.getElementById('app-container').classList.remove('hidden');
            startRealtimeListeners();
        } catch (error) {
            console.error("Auth Error:", error);
            showCustomAlert("Firebase Auth Error: Please create a user with email 'admin@booyah.com' and password '123456' in Firebase. You are being logged in without database write access.", "error");
            
            // Fallback: Login without Firebase
            localStorage.setItem('booyah_admin_logged_in', 'true');
            document.getElementById('login-screen').classList.add('hidden');
            document.getElementById('app-container').classList.remove('hidden');
            startRealtimeListeners();
        }
    } else {
        showCustomAlert("Invalid Security PIN! Access Denied.", "error");
        document.getElementById('admin-pin').value = ''; // clear input
    }
    
    loginBtn.textContent = 'AUTHORIZE';
    loginBtn.disabled = false;
};

// 2. Login directly with Email and Password
window.loginWithEmail = async function() {
    const email = document.getElementById('admin-email').value.trim();
    const password = document.getElementById('admin-password').value.trim();
    const btn = document.getElementById('admin-email-btn');

    if (!email || !password) {
        showCustomAlert("Please enter both Email and Password.", "error");
        return;
    }

    btn.textContent = 'SIGNING IN...';
    btn.disabled = true;

    try {
        await firebase.auth().signInWithEmailAndPassword(email, password);
        
        localStorage.setItem('booyah_admin_logged_in', 'true');
        document.getElementById('login-screen').classList.add('hidden');
        document.getElementById('app-container').classList.remove('hidden');
        startRealtimeListeners();
    } catch (error) {
        showCustomAlert("Authentication Failed: " + error.message, "error");
    } finally {
        btn.textContent = 'SIGN IN';
        btn.disabled = false;
    }
};

function logoutAdmin() {
    // Unsubscribe all real-time listeners
    if (usersUnsubscribe) { usersUnsubscribe(); usersUnsubscribe = null; }
    if (dashboardUnsubscribe) { dashboardUnsubscribe(); dashboardUnsubscribe = null; }
    if (monetagRef) { monetagRef.off(); monetagRef = null; }
    
    localStorage.removeItem('booyah_admin_logged_in');
    loginScreen.classList.remove('hidden');
    appContainer.classList.add('hidden');
}

// ==========================================
// REAL-TIME LISTENERS — Start Once on Login
// ==========================================

function startRealtimeListeners() {
    // Dashboard: real-time user count & settings
    dashboardUnsubscribe = db.collection('users').onSnapshot((snapshot) => {
        document.getElementById('stat-users').textContent = snapshot.size;
    }, (error) => {
        console.error("Dashboard listener error:", error);
        document.getElementById('stat-users').textContent = '—';
    });

    // Load Settings
    firebase.database().ref('settings/telegram_bot_url').on('value', (snap) => {
        const url = snap.val() || '';
        document.getElementById('admin-telegram-url').value = url;
    });

    // Users: real-time user list (always listening)
    startUsersRealtimeListener();

    // Monetag Links real-time list
    startMonetagListener();
    
    // Vault Codes real-time list
    startVaultCodesListener();
}

function startUsersRealtimeListener() {
    const tbody = document.getElementById('users-table-body');
    
    // Show skeleton loading rows immediately
    tbody.innerHTML = generateSkeletonRows(5);

    // Real-time listener — no orderBy('createdAt') to avoid index requirement issues
    // We sort client-side instead for reliability
    usersUnsubscribe = db.collection('users').onSnapshot((snapshot) => {
        // Convert to array and sort client-side
        allUsersData = [];
        snapshot.forEach(doc => {
            allUsersData.push({ id: doc.id, ...doc.data() });
        });

        // Sort: newest first (by createdAt if exists, otherwise by nickname)
        allUsersData.sort((a, b) => {
            const dateA = a.createdAt ? (a.createdAt.toDate ? a.createdAt.toDate() : new Date(a.createdAt)) : new Date(0);
            const dateB = b.createdAt ? (b.createdAt.toDate ? b.createdAt.toDate() : new Date(b.createdAt)) : new Date(0);
            return dateB - dateA;
        });

        // Update badge count
        const badge = document.getElementById('users-count-badge');
        if (badge) badge.textContent = allUsersData.length;

        // Render (respecting current search filter)
        filterUsers();
    }, (error) => {
        console.error("Users listener error:", error);
        tbody.innerHTML = `<tr><td colspan="7" class="p-6 text-center text-red-400">
            <div class="flex flex-col items-center gap-2">
                <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"/></svg>
                <span>Failed to load users: ${error.message}</span>
                <button onclick="startUsersRealtimeListener()" class="mt-2 bg-booyah hover:bg-[#E56000] text-white px-4 py-1.5 rounded-lg text-xs font-bold transition">Retry</button>
            </div>
        </td></tr>`;
    });
}

// ==========================================
// RENDER USERS TABLE
// ==========================================

function renderUsersTable(users) {
    const tbody = document.getElementById('users-table-body');
    tbody.innerHTML = '';

    if (users.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="p-6 text-center text-gray-500">No users found.</td></tr>';
        return;
    }

    users.forEach((user, index) => {
        const tr = document.createElement('tr');
        tr.className = 'row-animate hover:bg-gray-800/30 transition-colors';
        tr.style.animationDelay = `${index * 30}ms`;

        // Format date nicely
        const joinedDate = formatDate(user.createdAt);
        const lastClaimDate = formatDate(user.lastClaimTime);
        const nextClaimDate = user.nextClaimTime ? formatClaimStatus(user.nextClaimTime) : '<span class="text-green-400 text-xs">Available</span>';

        // Escape nickname for use in onclick
        const safeNickname = (user.nickname || 'Unknown').replace(/'/g, "\\'").replace(/"/g, '&quot;');

        tr.innerHTML = `
            <td class="px-6 py-4">
                <div class="flex items-center gap-3">
                    <img src="../${user.avatar || 'images/avatar/default_male.svg'}" class="w-8 h-8 rounded-full bg-gray-800 p-1" onerror="this.src='../images/avatar/default_male.svg'">
                    <div>
                        <div class="text-white font-bold text-base flex items-center gap-2">
                            ${user.nickname || 'Unknown'} 
                            <span class="bg-gray-800 text-gray-400 px-2 py-0.5 rounded text-xs font-mono border border-gray-700">ID: ${user.uid || user.id || 'N/A'}</span>
                        </div>
                        <div class="text-xs text-gray-500 mt-0.5">${user.email || 'No email'}</div>
                    </div>
                </div>
            </td>
            <td class="px-6 py-4 text-yellow-400 font-bold">${user.diamonds || 0}</td>
            <td class="px-6 py-4 text-orange-400 font-bold">${user.coins || 0}</td>
            <td class="px-6 py-4 text-xs">${lastClaimDate}</td>
            <td class="px-6 py-4 text-xs">${nextClaimDate}</td>
            <td class="px-6 py-4 text-gray-400 text-xs">${joinedDate}</td>
            <td class="px-6 py-4 text-right">
                <button onclick="openEditModal('${user.id}', '${safeNickname}', ${user.diamonds || 0}, ${user.coins || 0})" class="text-booyah hover:text-white transition font-medium text-xs bg-booyah/10 px-3 py-1.5 rounded hover:bg-booyah/20">Edit</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// ==========================================
// MONETAG ADS MANAGEMENT
// ==========================================

let confirmCallback = null;
let allMonetagUrls = []; // Store URLs globally for duplicate detection

function startMonetagListener() {
    const tbody = document.getElementById('monetag-table-body');
    const countBadge = document.getElementById('monetag-count-badge');
    
    // Realtime Database reference
    monetagRef = firebase.database().ref('settings/monetag_links');
    
    monetagRef.on('value', (snapshot) => {
        tbody.innerHTML = '';
        allMonetagUrls = [];
        let urlCounts = {};
        
        // First pass: populate list and count frequencies to detect duplicates
        if (snapshot.exists()) {
            snapshot.forEach((childSnapshot) => {
                const url = childSnapshot.val().url;
                allMonetagUrls.push(url);
                urlCounts[url] = (urlCounts[url] || 0) + 1;
            });
        }
        
        // Assign a unique Copy Group ID to each duplicated URL
        let copyGroupIdCounter = 1;
        let urlToGroupMap = {};
        for (const [url, count] of Object.entries(urlCounts)) {
            if (count > 1) {
                urlToGroupMap[url] = copyGroupIdCounter++;
            }
        }
        
        let count = 0;
        
        if (snapshot.exists()) {
            snapshot.forEach((childSnapshot) => {
                const id = childSnapshot.key;
                const url = childSnapshot.val().url;
                count++;
                
                // Determine if this URL gets a Copy Tag
                let copyTagHtml = '';
                if (urlToGroupMap[url]) {
                    copyTagHtml = `<span class="bg-booyah text-white text-[10px] px-2 py-0.5 rounded-full ml-3 uppercase font-black tracking-widest shadow-[0_0_10px_rgba(255,140,0,0.5)]">Copy Tag ${urlToGroupMap[url]}</span>`;
                }
                
                const tr = document.createElement('tr');
                tr.className = 'hover:bg-gray-800/30 transition border-b border-gray-800/50 row-animate';
                tr.innerHTML = `
                    <td class="px-6 py-3 font-black text-sm text-booyahYellow">#${count} <span class="font-mono text-[10px] text-gray-500 font-normal ml-2 tracking-wider opacity-70">${id}</span></td>
                    <td class="px-6 py-3 text-white truncate max-w-[200px]" title="${url}">
                        ${url}
                        ${copyTagHtml}
                    </td>
                    <td class="px-6 py-3 text-right flex items-center justify-end gap-2">
                        <button onclick="copyToClipboard('${url}')" class="text-gray-400 hover:text-white font-medium text-xs bg-gray-700/50 px-2 py-1.5 rounded transition" title="Copy Link">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 00-2-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>
                        </button>
                        <button onclick="editMonetagLink('${id}', '${url}')" class="text-blue-400 hover:text-blue-300 font-medium text-xs bg-blue-400/10 px-2 py-1.5 rounded hover:bg-blue-400/20 transition" title="Edit Link">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                        </button>
                        <button onclick="deleteMonetagLink('${id}')" class="text-red-400 hover:text-red-300 font-medium text-xs bg-red-400/10 px-2 py-1.5 rounded hover:bg-red-400/20 transition" title="Delete Link">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                        </button>
                    </td>
                `;
                tbody.appendChild(tr);
            });
        }
        
        countBadge.textContent = count;
            if (count === 0) {
                tbody.innerHTML = '<tr><td colspan="3" class="px-6 py-6 text-center text-gray-500 italic">No links added yet.</td></tr>';
            }
        }, (error) => {
            console.error("Monetag listener error:", error);
        });
}

function addMonetagLink() {
    const input = document.getElementById('monetag-link-input');
    const url = input.value.trim();
    if (!url) {
        showCustomAlert("Please enter a valid URL.", "error");
        return;
    }
    
    if (!url.startsWith('http')) {
        showCustomAlert("URL must start with http:// or https://", "error");
        return;
    }

    if (allMonetagUrls.includes(url)) {
        showCustomConfirm("You have already uploaded this URL before.\n\nDo you want to upload it again as a copy?", () => {
            pushMonetagLink(url, input);
        });
    } else {
        pushMonetagLink(url, input);
    }
}

function pushMonetagLink(url, input) {
    firebase.database().ref('settings/monetag_links').push({
        url: url,
        addedAt: firebase.database.ServerValue.TIMESTAMP
    }).then(() => {
        input.value = '';
        showCustomAlert("Link added successfully!", "success");
    }).catch(err => {
        showCustomAlert("Failed to add link: " + err.message, "error");
    });
}

function editMonetagLink(id, currentUrl) {
    const input = document.getElementById('monetag-link-input');
    input.value = currentUrl;
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
    
    showCustomConfirm("Do you want to edit this link?\n\nThis will remove the current link and place its URL in the input box above for you to modify.", () => {
        firebase.database().ref('settings/monetag_links').child(id).remove().catch(err => {
            showCustomAlert("Failed to remove old link: " + err.message, "error");
        });
    });
}

function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        showCustomAlert("Link copied to clipboard!", "success");
    }).catch(err => {
        console.error("Copy failed", err);
    });
}

function deleteMonetagLink(id) {
    showCustomConfirm("Are you sure you want to delete this link permanently?", () => {
        firebase.database().ref('settings/monetag_links').child(id).remove().then(() => {
            showCustomAlert("Link deleted successfully!", "success");
        }).catch(err => {
            showCustomAlert("Failed to delete link: " + err.message, "error");
        });
    });
}

// Custom Alert & Confirm Modals logic
function showCustomAlert(message, type = "error") {
    const modal = document.getElementById('admin-custom-alert');
    const msgEl = document.getElementById('alert-message');
    const titleEl = document.getElementById('alert-title');
    const iconErr = document.getElementById('alert-icon-error');
    const iconSucc = document.getElementById('alert-icon-success');

    msgEl.textContent = message;
    
    if (type === "error") {
        titleEl.textContent = "ERROR";
        titleEl.className = "text-lg font-black text-red-500 mb-2 uppercase tracking-widest";
        iconErr.classList.remove('hidden');
        iconSucc.classList.add('hidden');
    } else {
        titleEl.textContent = "SUCCESS";
        titleEl.className = "text-lg font-black text-emerald-500 mb-2 uppercase tracking-widest";
        iconErr.classList.add('hidden');
        iconSucc.classList.remove('hidden');
    }

    modal.classList.remove('hidden');
    setTimeout(() => {
        modal.classList.remove('opacity-0');
        modal.firstElementChild.classList.remove('scale-95');
    }, 10);
}

function closeCustomAlert() {
    const modal = document.getElementById('admin-custom-alert');
    modal.classList.add('opacity-0');
    modal.firstElementChild.classList.add('scale-95');
    setTimeout(() => {
        modal.classList.add('hidden');
    }, 300);
}

function showCustomConfirm(message, onConfirm) {
    const modal = document.getElementById('admin-custom-confirm');
    document.getElementById('confirm-message').textContent = message;
    confirmCallback = onConfirm;

    modal.classList.remove('hidden');
    setTimeout(() => {
        modal.classList.remove('opacity-0');
        modal.firstElementChild.classList.remove('scale-95');
    }, 10);
}

function closeCustomConfirm(isConfirmed) {
    const modal = document.getElementById('admin-custom-confirm');
    modal.classList.add('opacity-0');
    modal.firstElementChild.classList.add('scale-95');
    setTimeout(() => {
        modal.classList.add('hidden');
        if (isConfirmed && confirmCallback) {
            confirmCallback();
        }
        confirmCallback = null;
    }, 300);
}

// ==========================================
// SEARCH / FILTER
// ==========================================

function filterUsers() {
    const searchInput = document.getElementById('user-search-input');
    const query = searchInput ? searchInput.value.toLowerCase().trim() : '';

    if (!query) {
        renderUsersTable(allUsersData);
        return;
    }

    const filtered = allUsersData.filter(user => {
        const nickname = (user.nickname || '').toLowerCase();
        const email = (user.email || '').toLowerCase();
        const uid = (user.uid || user.id || '').toLowerCase();
        return nickname.includes(query) || email.includes(query) || uid.includes(query);
    });

    renderUsersTable(filtered);
}

// ==========================================
// NAVIGATION
// ==========================================

const ALL_TABS = ['dashboard', 'users', 'tournaments', 'notifications', 'monetag', 'vault-codes'];

function switchTab(tabId) {
    ALL_TABS.forEach(tab => {
        const view = document.getElementById(`view-${tab}`);
        if (view) view.classList.add('hidden');
        
        const tabBtn = document.getElementById(`tab-${tab}`);
        if (tabBtn) tabBtn.className = "w-full text-left px-4 py-3 rounded-lg text-gray-400 hover:bg-gray-800 hover:text-white font-medium transition";
    });

    const activeView = document.getElementById(`view-${tabId}`);
    if (activeView) activeView.classList.remove('hidden');
    
    const activeTab = document.getElementById(`tab-${tabId}`);
    if (activeTab) activeTab.className = "w-full text-left px-4 py-3 rounded-lg bg-booyah text-white font-medium transition";

    document.getElementById('page-title').textContent = tabId.charAt(0).toUpperCase() + tabId.slice(1);
}

// ==========================================
// EDIT USER MODAL & DYNAMIC LIMIT MANAGEMENT
// ==========================================

async function resetClaimTimer() {
    if (!currentEditingUserId) return;
    
    try {
        await db.collection('users').doc(currentEditingUserId).update({
            lastClaimTime: firebase.firestore.FieldValue.delete(),
            nextClaimTime: firebase.firestore.FieldValue.delete()
        });
        showCustomAlert("Claim timer reset! User can now claim instantly.", "success");
        document.getElementById('edit-claim-status').innerHTML = '<span class="text-green-400">✅ Timer reset — Available now</span>';
    } catch(e) {
        console.error('Failed to reset timer:', e);
        showCustomAlert("Failed to reset timer: " + e.message, "error");
    }
}

async function openEditModal(docId, nickname, diamonds, coins) {
    currentEditingUserId = docId;
    
    // Find active user profile from cached data array
    const user = allUsersData.find(u => u.id === docId);
    
    // Header Info
    document.getElementById('edit-user-name').textContent = nickname;
    document.getElementById('edit-user-uid').textContent = `UID: ${docId}`;
    document.getElementById('edit-user-avatar').src = user?.avatar || 'https://pub-4c6b2dbf3a0c4862a8964b1546de6283.r2.dev/Free%20fire/1780775687157_1780775598577.png';
    document.getElementById('edit-user-level').textContent = user?.level || 0;
    document.getElementById('edit-user-xp').textContent = user?.xp || 0;

    // Currency
    document.getElementById('edit-diamonds').value = diamonds;
    document.getElementById('edit-coins').value = coins;
    
    // Show claim status
    const claimStatus = document.getElementById('edit-claim-status');
    if (user && user.nextClaimTime) {
        const nextMs = user.nextClaimTime.toDate ? user.nextClaimTime.toDate().getTime() : (user.nextClaimTime.seconds ? user.nextClaimTime.seconds * 1000 : user.nextClaimTime);
        const now = Date.now();
        if (nextMs > now) {
            const remaining = nextMs - now;
            const h = Math.floor(remaining / (1000 * 60 * 60));
            const m = Math.floor((remaining / (1000 * 60)) % 60);
            claimStatus.innerHTML = `<span class="text-orange-400">⏳ Cooldown: ${h}h ${m}m remaining</span>`;
        } else {
            claimStatus.innerHTML = '<span class="text-green-400">✅ Available to claim</span>';
        }
    } else if (user && user.lastClaimTime) {
        claimStatus.innerHTML = '<span class="text-green-400">✅ Available to claim</span>';
    } else {
        claimStatus.innerHTML = '<span class="text-gray-500">Never claimed</span>';
    }
    
    // Load Vault Items
    await adminLoadUserVault(docId);

    const modal = document.getElementById('edit-user-modal');
    const box = document.getElementById('edit-user-modal-box');
    modal.classList.remove('hidden');
    setTimeout(() => box.classList.remove('scale-95'), 10);
}

async function adminLoadUserVault(uid) {
    const grid = document.getElementById('admin-user-vault-grid');
    grid.innerHTML = '<div class="col-span-full text-center py-4 text-gray-500 text-xs">Loading items...</div>';
    
    try {
        const snapshot = await db.collection('users').doc(uid).collection('vault').get();
        if (snapshot.empty) {
            grid.innerHTML = '<div class="col-span-full text-center py-10 text-gray-500 text-xs uppercase tracking-widest font-bold">Vault is Empty</div>';
            return;
        }

        grid.innerHTML = '';
        snapshot.forEach(doc => {
            const item = doc.data();
            const itemId = doc.id;
            
            grid.innerHTML += `
                <div class="bg-gray-800 rounded-xl p-2 border border-gray-700 relative group transition hover:border-booyahYellow">
                    <button onclick="adminRemoveVaultItem('${itemId}')" class="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition shadow-lg z-10 hover:bg-red-600">
                        <svg class="w-3 h-3" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
                    </button>
                    <div class="h-16 flex items-center justify-center bg-gray-900 rounded-lg mb-2 overflow-hidden">
                        <img src="${item.icon}" class="w-full h-full object-contain p-1">
                    </div>
                    <div class="text-[10px] text-white font-bold truncate text-center uppercase tracking-wider">${item.name}</div>
                    <div class="text-[9px] text-gray-400 font-bold truncate text-center uppercase">${item.category}</div>
                </div>
            `;
        });
    } catch(e) {
        grid.innerHTML = '<div class="col-span-full text-center py-4 text-red-500 text-xs">Failed to load vault</div>';
    }
}

async function adminAddVaultItem() {
    if(!currentEditingUserId) return;
    const codeInput = document.getElementById('add-vault-code-input');
    const code = codeInput.value.trim().toUpperCase();
    
    if(!code) {
        showCustomAlert("Please enter an item code.", "error");
        return;
    }

    try {
        const codeRef = db.collection('vault_codes').doc(code);
        const codeDoc = await codeRef.get();

        if (!codeDoc.exists) {
            showCustomAlert("Invalid Item Code!", "error");
            return;
        }

        const data = codeDoc.data();
        
        await db.collection('users').doc(currentEditingUserId).collection('vault').doc(code).set({
            name: data.name,
            category: data.category,
            icon: data.icon,
            acquiredAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        // Delete code from codes pool so it's consumed (or keep it if admin is assigning a universal code?)
        // Wait, standard vault items in 'vault_codes' are one-time. The admin can assign it and mark it used.
        await codeRef.update({ used: true });

        showCustomAlert("Item added to user's vault!", "success");
        codeInput.value = '';
        adminLoadUserVault(currentEditingUserId);
    } catch(e) {
        showCustomAlert("Error adding item: " + e.message, "error");
    }
}

async function adminRemoveVaultItem(itemId) {
    if(!currentEditingUserId || !confirm("Remove this item from user's vault?")) return;
    
    try {
        await db.collection('users').doc(currentEditingUserId).collection('vault').doc(itemId).delete();
        adminLoadUserVault(currentEditingUserId);
    } catch(e) {
        showCustomAlert("Failed to remove item", "error");
    }
}

function formatClaimStatus(timestamp) {
    if (!timestamp) return '<span class="text-green-400">Available</span>';
    try {
        let date;
        if (timestamp.toDate) date = timestamp.toDate();
        else if (timestamp.seconds) date = new Date(timestamp.seconds * 1000);
        else date = new Date(timestamp);
        
        if (isNaN(date.getTime())) return '<span class="text-gray-600">—</span>';
        
        const now = new Date();
        if (date > now) {
            const diff = date - now;
            const h = Math.floor(diff / (1000 * 60 * 60));
            const m = Math.floor((diff / (1000 * 60)) % 60);
            return `<span class="text-orange-400">${h}h ${m}m</span>`;
        } else {
            return '<span class="text-green-400">Available</span>';
        }
    } catch(e) {
        return '<span class="text-gray-600">—</span>';
    }
}

function closeEditModal() {
    const box = document.getElementById('edit-user-modal-box');
    box.classList.add('scale-95');
    setTimeout(() => {
        document.getElementById('edit-user-modal').classList.add('hidden');
        currentEditingUserId = null;
    }, 200);
}

async function saveUserBalance() {
    if (!currentEditingUserId) return;

    const diamonds = parseInt(document.getElementById('edit-diamonds').value) || 0;
    const coins = parseInt(document.getElementById('edit-coins').value) || 0;
    
    // Read user custom limit inputs
    const dmLimit = parseInt(document.getElementById('edit-dm-limit').value) || 100;
    const groupLimit = parseInt(document.getElementById('edit-group-limit').value) || 250;
    const channelLimit = parseInt(document.getElementById('edit-channel-limit').value) || 500;

    const btn = document.querySelector('#edit-user-modal button.bg-booyah');
    const originalText = btn.textContent;
    btn.textContent = 'Saving...';
    btn.disabled = true;

    try {
        await db.collection('users').doc(currentEditingUserId).update({
            diamonds: diamonds,
            coins: coins,
            dm_limit: dmLimit,
            group_limit: groupLimit,
            channel_limit: channelLimit
        });
        closeEditModal();
        showCustomAlert("User balance and limits updated successfully!", "success");
    } catch (error) {
        console.error("Error updating user:", error);
        showCustomAlert('Failed to update: ' + error.message, "error");
    } finally {
        btn.textContent = originalText;
        btn.disabled = false;
    }
}

// ==========================================
// NOTIFICATIONS
// ==========================================

async function sendGlobalNotification() {
    const imageUrl = document.getElementById('notif-image').value.trim();
    const message = document.getElementById('notif-message').value.trim();
    
    if(!message) {
        showCustomAlert("Please enter a message for the notification.", "error");
        return;
    }

    try {
        await db.collection('notifications').add({
            imageUrl: imageUrl || null,
            message: message,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
        showCustomAlert("Notification sent to all gamers!", "success");
        document.getElementById('notification-form').reset();
    } catch(e) {
        console.error("Error sending notification:", e);
        showCustomAlert("Failed to send notification.", "error");
    }
}

// ==========================================
// HELPER FUNCTIONS
// ==========================================

function formatDate(timestamp) {
    if (!timestamp) return '<span class="text-gray-600">—</span>';
    
    try {
        let date;
        if (timestamp.toDate) {
            date = timestamp.toDate();
        } else if (timestamp.seconds) {
            date = new Date(timestamp.seconds * 1000);
        } else if (typeof timestamp === 'string' || typeof timestamp === 'number') {
            date = new Date(timestamp);
        } else {
            return '<span class="text-gray-600">—</span>';
        }

        if (isNaN(date.getTime())) return '<span class="text-gray-600">—</span>';

        const now = new Date();
        const diffMs = now - date;
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        if (diffDays === 0) {
            const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
            if (diffHours === 0) {
                const diffMins = Math.floor(diffMs / (1000 * 60));
                return `<span class="text-green-400">${diffMins <= 1 ? 'Just now' : diffMins + 'm ago'}</span>`;
            }
            return `<span class="text-green-400">${diffHours}h ago</span>`;
        } else if (diffDays === 1) {
            return 'Yesterday';
        } else if (diffDays < 7) {
            return `${diffDays}d ago`;
        }

        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
    } catch (e) {
        return '<span class="text-gray-600">—</span>';
    }
}

function generateSkeletonRows(count) {
    let html = '';
    for (let i = 0; i < count; i++) {
        html += `
        <tr>
            <td class="px-6 py-4">
                <div class="flex items-center gap-3">
                    <div class="skeleton w-8 h-8 rounded-full"></div>
                    <div>
                        <div class="skeleton w-32 h-4 mb-2"></div>
                        <div class="skeleton w-24 h-3"></div>
                    </div>
                </div>
            </td>
            <td class="px-6 py-4"><div class="skeleton w-12 h-4"></div></td>
            <td class="px-6 py-4"><div class="skeleton w-12 h-4"></div></td>
            <td class="px-6 py-4"><div class="skeleton w-20 h-4"></div></td>
            <td class="px-6 py-4 text-right"><div class="skeleton w-20 h-6 ml-auto"></div></td>
        </tr>`;
    }
    return html;
}

// ==========================================
// VAULT CODES
// ==========================================

function generateRandomCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = 'BW-';
    for (let i = 0; i < 4; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
    code += '-';
    for (let i = 0; i < 4; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
    return code;
}

async function generateVaultCode() {
    const name = document.getElementById('vc-name').value.trim();
    const category = document.getElementById('vc-category').value;
    const icon = document.getElementById('vc-icon').value.trim();
    
    if (!name || !icon) {
        showCustomAlert("Please fill in all fields.", "error");
        return;
    }
    
    const code = generateRandomCode();
    
    try {
        await db.collection('vault_codes').doc(code).set({
            name: name,
            category: category,
            icon: icon,
            used: false,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        showCustomAlert("Code Generated Successfully!\\n" + code, "success");
        document.getElementById('vault-code-form').reset();
    } catch(e) {
        console.error("Error generating code:", e);
        showCustomAlert("Failed to generate code.", "error");
    }
}

function startVaultCodesListener() {
    db.collection('vault_codes').orderBy('createdAt', 'desc').onSnapshot((snapshot) => {
        const tbody = document.getElementById('vault-codes-tbody');
        tbody.innerHTML = '';
        
        if (snapshot.empty) {
            tbody.innerHTML = `<tr><td colspan="5" class="px-6 py-4 text-center text-gray-500">No codes generated yet.</td></tr>`;
            return;
        }
        
        snapshot.forEach(doc => {
            const data = doc.data();
            const statusClass = data.used ? 'text-red-400 bg-red-400/10' : 'text-green-400 bg-green-400/10';
            const statusText = data.used ? 'USED' : 'ACTIVE';
            
            tbody.innerHTML += `
                <tr class="hover:bg-gray-800/30 transition">
                    <td class="px-6 py-4 font-mono font-bold text-booyahYellow">${doc.id}</td>
                    <td class="px-6 py-4 text-white">
                        <div class="flex items-center gap-3">
                            <div class="w-10 h-10 bg-gray-900 border border-gray-700 rounded overflow-hidden flex items-center justify-center p-1">
                                <img src="${data.icon || ''}" class="max-w-full max-h-full object-contain">
                            </div>
                            <span>${data.name}</span>
                        </div>
                    </td>
                    <td class="px-6 py-4 uppercase text-xs font-bold text-gray-400">${data.category}</td>
                    <td class="px-6 py-4">
                        <span class="px-2 py-1 rounded text-xs font-bold ${statusClass}">${statusText}</span>
                    </td>
                    <td class="px-6 py-4 text-right space-x-3">
                        <button onclick="editVaultCode('${doc.id}', '${data.name.replace(/'/g, "\\'")}', '${data.category}', '${data.icon}')" class="text-booyahYellow hover:text-white font-medium">Edit</button>
                        <button onclick="deleteVaultCode('${doc.id}')" class="text-red-400 hover:text-red-300 font-medium">Delete</button>
                    </td>
                </tr>
            `;
        });
    });
}

window.deleteVaultCode = function(id) {
    document.getElementById('confirm-message').textContent = `Are you sure you want to delete code ${id}?`;
    document.getElementById('admin-custom-confirm').classList.remove('hidden');
    
    setTimeout(() => {
        document.getElementById('admin-custom-confirm').classList.remove('opacity-0');
    }, 10);
    
    window.pendingConfirmAction = async function() {
        try {
            await db.collection('vault_codes').doc(id).delete();
            showCustomAlert("Code deleted.", "success");
        } catch(e) {
            showCustomAlert("Failed to delete.", "error");
        }
    };
};

async function saveTelegramBotUrl() {
    const url = document.getElementById('admin-telegram-url').value.trim();
    try {
        await firebase.database().ref('settings/telegram_bot_url').set(url);
        showCustomAlert("Telegram Bot Link Saved!", "success");
    } catch(e) {
        showCustomAlert("Failed to save link: " + e.message, "error");
    }
}

// ==========================================
// IMAGE PREVIEW LOGIC
// ==========================================
function getImagePath(filename, category) {
    if (!filename) return "";
    // If it looks like a full url or absolute path, return as is
    if (filename.startsWith('http') || filename.startsWith('./') || filename.startsWith('/')) {
        return filename;
    }
    return `images/${category}/${filename}`;
}

async function loadVaultImageGallery(isEdit = false) {
    const categoryId = isEdit ? 'edit-vc-category' : 'vc-category';
    const gridId = isEdit ? 'edit-image-picker-grid' : 'image-picker-grid';
    const loadingId = isEdit ? 'edit-gallery-loading' : 'gallery-loading';
    const selectedInputId = isEdit ? 'edit-vc-icon' : 'vc-icon';
    const selectedNameId = isEdit ? 'edit-vc-selected-name' : 'vc-selected-name';

    const category = document.getElementById(categoryId).value;
    const grid = document.getElementById(gridId);
    const loading = document.getElementById(loadingId);
    
    loading.classList.remove('hidden');
    grid.innerHTML = '';
    
    try {
        // Fetch used images from Firestore to gray them out
        const snapshot = await db.collection('vault_codes').where('category', '==', category).get();
        const usedIcons = new Set();
        snapshot.forEach(doc => {
            const data = doc.data();
            if (data.icon) usedIcons.add(data.icon);
        });

        // Fetch all available images from Node.js Backend API
        const response = await fetch(`/api/images/${category}`);
        if (!response.ok) throw new Error("Backend not running or error");
        const data = await response.json();
        
        if (data.images && data.images.length > 0) {
            data.images.forEach(filename => {
                const fullPath = `images/${category}/${filename}`;
                const isUsed = usedIcons.has(fullPath);
                
                const imgDiv = document.createElement('div');
                imgDiv.className = `relative cursor-pointer rounded-lg border-2 overflow-hidden transition-all duration-200 ${isUsed ? 'opacity-40 border-gray-800 grayscale' : 'border-gray-700 hover:border-booyahYellow hover:scale-105'}`;
                imgDiv.innerHTML = `
                    <div class="h-16 w-full flex items-center justify-center bg-black/50 p-1">
                        <img src="../${fullPath}" class="max-w-full max-h-full object-contain">
                    </div>
                    ${isUsed ? '<div class="absolute inset-0 flex items-center justify-center bg-black/60"><span class="text-[8px] font-bold text-white bg-red-500 px-1 rounded uppercase">Added</span></div>' : ''}
                `;
                
                imgDiv.onclick = () => {
                    document.getElementById(selectedInputId).value = filename;
                    document.getElementById(selectedNameId).textContent = filename;
                    // Highlight selection
                    Array.from(grid.children).forEach(child => child.classList.remove('border-booyahYellow', 'shadow-[0_0_10px_rgba(255,204,0,0.5)]'));
                    if (!isUsed) {
                        imgDiv.classList.add('border-booyahYellow', 'shadow-[0_0_10px_rgba(255,204,0,0.5)]');
                    }
                };
                
                grid.appendChild(imgDiv);
            });
        } else {
            grid.innerHTML = `<div class="col-span-full text-center text-xs text-gray-500 py-4">No images found in images/${category}</div>`;
        }
    } catch (e) {
        console.error(e);
        grid.innerHTML = `<div class="col-span-full text-center text-xs text-red-500 py-4">Error loading images. Is server.js running?</div>`;
    } finally {
        loading.classList.add('hidden');
    }
}

window.updateVaultImagePreview = function() {
    loadVaultImageGallery(false);
}

window.updateEditVaultImagePreview = function() {
    loadVaultImageGallery(true);
}

// Call on initial load
setTimeout(() => {
    updateVaultImagePreview();
}, 1000);

// Override generateVaultCode to use the smart path logic
const originalGenerateVaultCode = window.generateVaultCode;
window.generateVaultCode = async function() {
    const name = document.getElementById('vc-name').value.trim();
    const category = document.getElementById('vc-category').value;
    let icon = document.getElementById('vc-icon').value.trim();
    
    if(!name || !icon) return showCustomAlert("Please fill all fields", "error");
    
    // Convert filename to full path if it's not a URL
    icon = getImagePath(icon, category);
    
    const code = Math.random().toString(36).substring(2, 10).toUpperCase();
    
    try {
        await db.collection('vault_codes').doc(code).set({
            name: name,
            category: category,
            icon: icon,
            used: false,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        showCustomAlert(`Code Generated: ${code}`, "success");
        document.getElementById('vault-code-form').reset();
        updateVaultImagePreview();
    } catch(e) {
        showCustomAlert("Error generating code: " + e.message, "error");
    }
}

// ==========================================
// EDIT VAULT CODE LOGIC
// ==========================================
window.editVaultCode = function(id, name, category, icon) {
    document.getElementById('edit-vc-id').value = id;
    document.getElementById('edit-vc-name').value = name;
    document.getElementById('edit-vc-category').value = category;
    
    // If the icon path matches the standard images/category/ path, extract just the filename
    const standardPrefix = `images/${category}/`;
    if (icon && icon.startsWith(standardPrefix)) {
        document.getElementById('edit-vc-icon').value = icon.replace(standardPrefix, '');
    } else {
        document.getElementById('edit-vc-icon').value = icon;
    }
    
    updateEditVaultImagePreview();
    
    document.getElementById('edit-vault-code-modal').classList.remove('hidden');
    setTimeout(() => {
        document.getElementById('edit-vault-code-modal').classList.remove('opacity-0');
    }, 10);
};

window.closeEditVaultCodeModal = function() {
    document.getElementById('edit-vault-code-modal').classList.add('opacity-0');
    setTimeout(() => {
        document.getElementById('edit-vault-code-modal').classList.add('hidden');
    }, 300);
};

window.saveEditedVaultCode = async function() {
    const id = document.getElementById('edit-vc-id').value;
    const name = document.getElementById('edit-vc-name').value.trim();
    const category = document.getElementById('edit-vc-category').value;
    let icon = document.getElementById('edit-vc-icon').value.trim();
    
    if(!name || !icon) return showCustomAlert("Please fill all fields", "error");
    
    icon = getImagePath(icon, category);
    
    try {
        await db.collection('vault_codes').doc(id).update({
            name: name,
            category: category,
            icon: icon
        });
        showCustomAlert("Vault code updated successfully!", "success");
        closeEditVaultCodeModal();
    } catch(e) {
        showCustomAlert("Failed to update: " + e.message, "error");
    }
};