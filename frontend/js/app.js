/* =======================================================================
   DEMO PERSISTENCE LAYER
   Everything below reads/writes a single localStorage object as a stand-in
   for real API calls (see api-spec.md) against schema.sql. Every function
   that would be a network call is named api_* and commented with the real
   endpoint it corresponds to, so swapping this for `fetch()` calls to a
   real backend is a mechanical change, not a redesign.
   ======================================================================= */
const DB_KEY = 'abingdon_library_demo_v1';
function loadDB(){
  try{ return Object.assign(freshDB(), JSON.parse(localStorage.getItem(DB_KEY)) || {}); }catch(e){ return freshDB(); }
}
function freshDB(){
  return { books: [], loans: [], reservations: [], favourites: [], readingLists: [], reviews: [],
    classCheckouts: [], purchaseRequests: [], apiConfig: {},
    users: [
      {id:'u1', name:'James Taylor', role:'student', email:'student@abingdon.org.uk'},
      {id:'u2', name:'Mrs. Alden', role:'librarian', email:'e.alden@abingdon.org.uk'},
      {id:'u3', name:'Graham Gardner', role:'head_of_library', email:'graham.gardner@abingdon.org.uk'},
      {id:'u4', name:'Staff Member', role:'staff', email:'staff@abingdon.org.uk'}
    ] };
}
function saveDB(db){ try{ localStorage.setItem(DB_KEY, JSON.stringify(db)); }catch(e){} }
let db = loadDB();

function toast(msg){
  const t=document.getElementById('toast'); t.textContent=msg; t.classList.add('show');
  clearTimeout(window._toastTimer); window._toastTimer=setTimeout(()=>t.classList.remove('show'),2600);
}

/* ---------------- AUTH ---------------- */

// TEMPORARY hardcoded accounts — see note in chat: hashed so passwords aren't sitting in plain
// text in the page source, but this is still obfuscation, not real security. Anyone with dev
// tools open can watch the check run and brute-force a short password against the hash. Fine
// for demos with people you trust in the room; replace with auth.ts + a real database before
// this ever touches real student/staff data.
//
// graham.gardner@abingdon.org.uk / admin   → Head of Library (full admin access)
// e.alden@abingdon.org.uk / library2026     → Librarian (placeholder — tell me the real one)
// staff@abingdon.org.uk / staff2026         → Staff (placeholder — tell me the real one)
// student@abingdon.org.uk / student2026     → Student (placeholder — tell me the real one)
const ACCOUNTS = {
  'graham.gardner@abingdon.org.uk': { hash:'ac7d6d4ba436b9a4e23d89d810b4c8172bfd7c294c3b691506eeaac7d01cf4fa', role:'head_of_library', name:'Graham Gardner' },
  'e.alden@abingdon.org.uk':         { hash:'5a176e11f8ec11fd66981d6226cdcf953a197ffbc977c19b63cb626eaa7011b3', role:'librarian', name:'Mrs. Alden' },
  'staff@abingdon.org.uk':           { hash:'d6d3f189daaff8d0bdb8e394361c323d3f72db8e85d33e587a13f21b6589a816', role:'staff', name:'Staff Member' },
  'student@abingdon.org.uk':         { hash:'267759eebdbc651a6a1f9dbf686630e90392378fdd18d7705d9410a907a5cc1c', role:'student', name:'James Taylor' },
};
async function sha256(str){
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,'0')).join('');
}

async function handlePasswordLogin(e){
  e.preventDefault();
  const email=document.getElementById('loginEmail').value.trim().toLowerCase(), password=document.getElementById('loginPass').value;
  const err=document.getElementById('loginError'); err.classList.remove('show');

  const account = ACCOUNTS[email];
  if(account){
    const enteredHash = await sha256(email+':'+password);
    const customHash = localStorage.getItem('abingdon_custom_pw_'+email); // set once someone changes their password
    if(enteredHash===account.hash || (customHash && enteredHash===customHash)){
      enterApp(account.role, account.name, email);
      return false;
    }
  }

  try{
    // Real call — see auth.ts: POST /api/auth/login/password { email, password }
    const res = await fetch('/api/auth/login/password',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password})});
    if(!res.ok) throw new Error('Invalid credentials');
    const {role} = await res.json();
    enterApp(role, email.split('@')[0], email);
  }catch(err2){
    err.textContent = "That email/password wasn't recognised.";
    err.classList.add('show');
  }
  return false;
}

async function handleGoogleLogin(){
  // Real integration point — needs Abingdon's own GOOGLE_CLIENT_ID (see auth.ts):
  // google.accounts.id.initialize({ client_id: GOOGLE_CLIENT_ID, callback: onGoogleCredential });
  // google.accounts.id.prompt();
  toast("No live Google OAuth client is configured yet — sign in with email and password for now.");
}

async function handlePasskeyLogin(){
  if(!window.PublicKeyCredential){ toast('This browser does not support passkeys.'); return; }
  try{
    // Real flow: fetch challenge from POST /api/auth/passkey/login/options,
    // then navigator.credentials.get({ publicKey: options }), then verify server-side.
    const res = await fetch('/api/auth/passkey/login/options',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:document.getElementById('loginEmail').value})});
    if(!res.ok) throw new Error('no backend');
  }catch(e){
    toast('No live passkey backend is connected yet — sign in with email and password for now.');
  }
}

const SESSION_KEY = 'abingdon_session_v1';
function enterApp(role, name, email){
  document.getElementById('loginScreen').style.display='none';
  document.getElementById('app').style.display='block';
  document.getElementById('rolePill').textContent = role.replace(/_/g,' ').toUpperCase();
  document.getElementById('avatarInitials').textContent = (name||'U').split(' ').map(w=>w[0]).slice(0,2).join('').toUpperCase();
  document.getElementById('studentView').classList.add('hidden');
  document.getElementById('librarianView').classList.add('hidden');
  document.getElementById('staffView').classList.add('hidden');
  document.getElementById('studentNavLinks').classList.add('hidden');
  document.getElementById('staffNavLinks').classList.add('hidden');

  if(role==='librarian'||role==='head_of_library'){
    document.getElementById('librarianView').classList.remove('hidden');
    renderAdminSidebar(role);
    renderAdminTab('dashboard', role);
  } else if(role==='staff'){
    document.getElementById('staffView').classList.remove('hidden');
    document.getElementById('staffNavLinks').classList.remove('hidden');
    showStaffTab('dashboard', document.querySelector('#staffNavLinks a'));
  } else {
    document.getElementById('studentView').classList.remove('hidden');
    document.getElementById('studentNavLinks').classList.remove('hidden');
    renderStudentHome(); renderCatalogueTab(); renderMyLibrary('loans'); renderLists();
  }
  try{ localStorage.setItem(SESSION_KEY, JSON.stringify({role,name,email})); }catch(e){}
  if(email) checkWelcome(email, name);
}
function logout(){
  // Real call: POST /api/auth/logout (destroys session server-side)
  try{ localStorage.removeItem(SESSION_KEY); }catch(e){}
  document.getElementById('app').style.display='none';
  document.getElementById('loginScreen').style.display='flex';
}
// Persisted session — staff/librarians who use this daily shouldn't have to sign in every time.
// A real deployment would check an httpOnly session cookie server-side instead of trusting this.
(function resumeSession(){
  try{
    const s = JSON.parse(localStorage.getItem(SESSION_KEY));
    if(s && s.role) enterApp(s.role, s.name, s.email);
  }catch(e){}
})();

/* ---------------- STUDENT: nav ---------------- */
function showStudentTab(name, el){
  document.querySelectorAll('#studentNavLinks a').forEach(a=>a.classList.remove('active'));
  el.classList.add('active');
  ['home','catalogue','mylibrary','lists'].forEach(t=>document.getElementById('tab-'+t).classList.toggle('hidden', t!==name));
}

function emptyStateHTML(icon,title,body,cta,ctaFn){
  return `<div class="empty-state"><div class="icon">${icon}</div><h4>${title}</h4><p>${body}</p>
    ${cta?`<button class="btn btn-primary" onclick="${ctaFn}">${cta}</button>`:''}</div>`;
}

function renderStudentHome(){
  const el=document.getElementById('homeEmpty'), rails=document.getElementById('homeRails');
  if(db.books.length===0){
    el.innerHTML = emptyStateHTML('📚','The catalogue is being set up','Once the Librarian adds or imports books, your personalised recommendations, staff picks and new arrivals will appear here.','',null);
    rails.innerHTML='';
  } else {
    el.innerHTML='';
    rails.innerHTML = `<div class="grid-books">${db.books.map(bookCard).join('')}</div>`;
  }
}
function renderCatalogueTab(){
  const el=document.getElementById('catalogueEmpty'), grid=document.getElementById('catalogueGrid');
  if(db.books.length===0){
    el.innerHTML = emptyStateHTML('🔍','No books in the catalogue yet','Ask your Librarian to add books or import a CSV from the Librarian portal.','',null);
    grid.innerHTML='';
  } else { el.innerHTML=''; grid.innerHTML = db.books.map(bookCard).join(''); }
}
function coverHTML(b){ return b.cover?`<img src="${b.cover}" style="width:100%;height:100%;object-fit:cover;" alt="">`:`<div class="fallback-cover"><div class="t">${b.title}</div><div class="a">${b.author}</div></div>`; }
function bookCard(b){
  return `<div class="book-card"><div class="book-cover-wrap">${coverHTML(b)}</div>
    <div class="book-meta"><div class="title">${b.title}</div><div class="author">${b.author}</div>
    <div class="avail-row"><span class="avail-dot"></span>${b.copies} ${b.copies==1?'copy':'copies'}</div></div>
    <div style="display:flex;gap:6px;margin-top:8px;">
      <button class="btn btn-primary" style="flex:1;justify-content:center;padding:6px 0;font-size:12px;" onclick="api_borrow('${b.id}')">Borrow</button>
      <button class="btn btn-outline" style="padding:6px 8px;font-size:12px;" onclick="api_favourite('${b.id}')">♡</button>
    </div></div>`;
}
// api_borrow ↔ real: POST /reservations or a loan endpoint depending on availability
function api_borrow(id){
  const b=db.books.find(x=>x.id===id); if(!b) return;
  db.loans.push({id:crypto.randomUUID(), bookId:id, title:b.title, borrowedAt:Date.now(), dueAt:Date.now()+1000*60*60*24*14, status:'active'});
  saveDB(db); toast(`Borrowed “${b.title}”`); renderMyLibrary('loans');
}
function api_favourite(id){
  const b=db.books.find(x=>x.id===id); if(!b) return;
  if(!db.favourites.find(f=>f.bookId===id)){ db.favourites.push({bookId:id,title:b.title,author:b.author,cover:b.cover}); saveDB(db); toast(`Saved “${b.title}”`); }
}

/* ---------------- STUDENT: My Library ---------------- */
function setMyLibTab(t,el){ document.querySelectorAll('#tab-mylibrary .tab').forEach(x=>x.classList.remove('active')); el.classList.add('active'); renderMyLibrary(t); }
function renderMyLibrary(t){
  const c=document.getElementById('mylibContent');
  if(t==='loans'){
    c.innerHTML = db.loans.length ? `<table><tr><th>Title</th><th>Borrowed</th><th>Due</th><th>Status</th></tr>${
      db.loans.map(l=>`<tr><td>${l.title}</td><td>${new Date(l.borrowedAt).toLocaleDateString()}</td><td>${new Date(l.dueAt).toLocaleDateString()}</td><td><span class="status-pill active">On loan</span></td></tr>`).join('')}</table>`
      : emptyStateHTML('📖','Nothing borrowed yet','Books you borrow from the catalogue will show up here with their due date.','',null);
  } else if(t==='reservations'){
    c.innerHTML = db.reservations.length ? `<table><tr><th>Title</th><th>Queued</th><th>Status</th></tr>${
      db.reservations.map(r=>`<tr><td>${r.title}</td><td>${new Date(r.queuedAt).toLocaleDateString()}</td><td><span class="status-pill ready">Queued</span></td></tr>`).join('')}</table>`
      : emptyStateHTML('🕓','No reservations','Reserve a book that is currently unavailable and it will appear here.','',null);
  } else {
    c.innerHTML = db.favourites.length ? `<div class="grid-books">${db.favourites.map(f=>`<div class="book-card"><div class="book-cover-wrap">${coverHTML({title:f.title,author:f.author,cover:f.cover})}</div><div class="book-meta"><div class="title">${f.title}</div><div class="author">${f.author}</div></div></div>`).join('')}</div>`
      : emptyStateHTML('♡','Your reading shelf is empty','Save books here so you can find them later.','Browse the catalogue',"showStudentTab('catalogue', document.querySelectorAll('#studentNavLinks a')[1])");
  }
}
function renderLists(){
  const c=document.getElementById('listsContent');
  c.innerHTML = db.readingLists.length ? db.readingLists.map(l=>`<div class="card"><strong>${l.title}</strong><div style="font-size:12.5px;color:var(--color-text-2);margin-top:4px;">${l.items.length} book(s) · ${l.visibility}</div></div>`).join('')
    : emptyStateHTML('📋','No reading lists yet','Create a private list — "Summer Reading", "Sci-Fi", whatever helps you keep track.','+ New list','createReadingList()');
}
function createReadingList(){
  const title=prompt('Reading list name:'); if(!title) return;
  db.readingLists.push({id:crypto.randomUUID(),title,visibility:'private',items:[]}); saveDB(db); renderLists(); toast('Reading list created');
}

/* ---------------- LIBRARIAN / HEAD OF LIBRARY ---------------- */
let currentAdminRole = null;
const ADMIN_TABS = {
  dashboard:       { label:'📊 Dashboard',              section:'Overview',    roles:['librarian','head_of_library'], render:adminDashboard },
  catalogue:       { label:'📚 Catalogue',               section:'Catalogue',   roles:['librarian','head_of_library'], render:adminCatalogue },
  import:          { label:'⬆ CSV Import',              section:'Catalogue',   roles:['head_of_library'],             render:adminImport },
  loans:           { label:'🔄 Loans',                   section:'Circulation', roles:['librarian','head_of_library'], render:adminLoans },
  reservations:    { label:'🕓 Reservations',            section:'Circulation', roles:['librarian','head_of_library'], render:adminReservations },
  users:           { label:'👥 Users',                   section:'Community',   roles:['librarian','head_of_library'], render:adminUsers },
  reviews:         { label:'💬 Reviews',                 section:'Community',   roles:['librarian','head_of_library'], render:adminReviews },
  recommendations: { label:'✦ Recommendations',          section:'Community',   roles:['librarian','head_of_library'], render:adminRecs },
  integrations:    { label:'🔌 Integrations & API Keys', section:'System (Head of Library only)', roles:['head_of_library'], render:adminIntegrations },
  ai:              { label:'🤖 AI Controls',             section:'System (Head of Library only)', roles:['head_of_library'], render:adminAI },
  audit:           { label:'🛡 Audit Log',               section:'System (Head of Library only)', roles:['head_of_library'], render:adminAudit },
  settings:        { label:'⚙ System Settings',          section:'System (Head of Library only)', roles:['head_of_library'], render:adminSettings },
};
function renderAdminSidebar(role){
  currentAdminRole = role;
  const sections = [];
  Object.entries(ADMIN_TABS).forEach(([key,t])=>{
    if(!t.roles.includes(role)) return;
    let s = sections.find(s=>s.name===t.section);
    if(!s){ s={name:t.section, items:[]}; sections.push(s); }
    s.items.push({key, label:t.label});
  });
  document.getElementById('adminSidebar').innerHTML = sections.map(s=>`
    <div class="section-label">${s.name}</div>
    ${s.items.map((it,i)=>`<div class="admin-nav-item${s===sections[0]&&i===0?' active':''}" onclick="showAdminTab('${it.key}',this)">${it.label}</div>`).join('')}
  `).join('');
}
function showAdminTab(name, el){
  if(!ADMIN_TABS[name].roles.includes(currentAdminRole)){ toast('Your account does not have access to this.'); return; }
  document.querySelectorAll('.admin-nav-item').forEach(i=>i.classList.remove('active'));
  el.classList.add('active');
  renderAdminTab(name);
}
function renderAdminTab(name){
  document.getElementById('adminMain').innerHTML = ADMIN_TABS[name].render();
}
function adminDashboard(){
  const isHoL = currentAdminRole==='head_of_library';
  return `<div class="admin-header"><h2>Dashboard</h2></div>
  <div class="notice">Demo persistence — this data lives in your browser only. Deploy against schema.sql + api-spec.md for the real thing.</div>
  <div class="dash-cards">
    <div class="dash-card"><div class="n">${db.books.length}</div><div class="l">Total books</div></div>
    <div class="dash-card"><div class="n">${db.loans.filter(l=>l.status==='active').length}</div><div class="l">On loan</div></div>
    <div class="dash-card"><div class="n">${db.reservations.length}</div><div class="l">Reservations</div></div>
    <div class="dash-card"><div class="n">${db.users.length}</div><div class="l">Registered users</div></div>
    <div class="dash-card"><div class="n">0</div><div class="l">Overdue</div></div>
    <div class="dash-card"><div class="n">${db.reviews.filter(r=>r.status==='pending').length}</div><div class="l">Reviews to moderate</div></div>
  </div>
  <div class="card"><strong>Purchase requests from staff</strong>${
    db.purchaseRequests.length ? `<table style="margin-top:10px;"><tr><th>Title</th><th>Requested by</th><th>Reason</th></tr>${
      db.purchaseRequests.map(r=>`<tr><td>${r.title}</td><td>${r.by}</td><td>${r.reason||'—'}</td></tr>`).join('')}</table>`
      : `<p style="font-size:13px;color:var(--color-text-2);margin-top:10px;">None yet.</p>`}</div>
  ${isHoL ? `<div class="card"><strong>Integration status</strong>${integrationRows()}</div>` : ''}`;
}
function integrationRows(){
  const cfg = db.apiConfig || {};
  const items=[['VLEbooks', cfg.vlebooksKey?'degraded':'disabled'],['Browns Books', cfg.brownsKey?'degraded':'disabled'],
    ['Amazon Business', cfg.amazonKey?'degraded':'disabled'],['Gemini AI', cfg.geminiKey?'degraded':'disabled']];
  return items.map(([n,s])=>`<div class="integration-row"><span class="integration-name"><span class="status-dot ${s}"></span>${n}</span><span style="font-size:12px;color:var(--color-text-3);text-transform:capitalize;">${s==='disabled'?'disabled — needs credentials':'key saved — not yet verified against a live endpoint'}</span></div>`).join('');
}
function adminCatalogue(){
  const rows = db.books.map(b=>`<tr><td>${b.title}</td><td>${b.author}</td><td>${b.isbn||'—'}</td><td>${b.copies}</td>
    <td><button class="btn btn-tertiary" onclick="removeBook('${b.id}')">Remove</button></td></tr>`).join('');
  return `<div class="admin-header"><h2>Catalogue</h2><button class="btn btn-primary" onclick="toggleAddBook()">+ Add book</button></div>
    <div id="addBookForm" class="card hidden">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
        <div class="field"><label>Title</label><input id="nbTitle" type="text" placeholder="Never Let Me Go"></div>
        <div class="field"><label>Author</label><input id="nbAuthor" type="text" placeholder="Kazuo Ishiguro"></div>
        <div class="field"><label>ISBN-13</label><input id="nbIsbn" type="text" placeholder="9780571273188"></div>
        <div class="field"><label>Copies</label><input id="nbCopies" type="number" value="1" min="1"></div>
        <div class="field" style="grid-column:1/-1;"><label>Cover image URL (optional)</label><input id="nbCover" type="text" placeholder="https://…"></div>
      </div>
      <button class="btn btn-primary" onclick="addBook()">Add to catalogue</button>
      <button class="btn btn-tertiary" onclick="toggleAddBook()">Cancel</button>
    </div>
    ${db.books.length ? `<table><tr><th>Title</th><th>Author</th><th>ISBN</th><th>Copies</th><th></th></tr>${rows}</table>`
      : emptyStateHTML('📚','Catalogue is empty','Add your first book here.' + (currentAdminRole==='head_of_library' ? ' Head of Library can also use CSV Import for bulk collections.' : ''),'+ Add book','toggleAddBook()')}`;
}
function toggleAddBook(){ document.getElementById('addBookForm').classList.toggle('hidden'); }
function addBook(){
  const title=document.getElementById('nbTitle').value.trim(), author=document.getElementById('nbAuthor').value.trim();
  if(!title||!author){ toast('Title and author are required'); return; }
  db.books.push({id:crypto.randomUUID(), title, author, isbn:document.getElementById('nbIsbn').value.trim(),
    copies:Number(document.getElementById('nbCopies').value)||1, cover:document.getElementById('nbCover').value.trim()});
  saveDB(db); toast('Book added to catalogue'); renderAdminTab('catalogue');
}
function removeBook(id){ db.books = db.books.filter(b=>b.id!==id); saveDB(db); renderAdminTab('catalogue'); toast('Book removed'); }

function adminImport(){
  return `<div class="admin-header"><h2>CSV Import</h2></div>
  <div class="card">
    <div class="csv-drop">Drop a CSV here, or paste rows below.<br><span style="font-size:11.5px;">Expected headers: title,author,isbn,copies</span></div>
    <textarea id="csvInput" rows="6" placeholder="title,author,isbn,copies&#10;Never Let Me Go,Kazuo Ishiguro,9780571273188,2"></textarea>
    <div style="margin-top:12px;display:flex;gap:8px;">
      <button class="btn btn-secondary" onclick="previewCSV()">Preview</button>
      <button class="btn btn-primary" onclick="commitCSV()">Import</button>
    </div>
    <div id="csvPreview" style="margin-top:16px;"></div>
  </div>`;
}
function parseCSV(){
  const raw=document.getElementById('csvInput').value.trim(); if(!raw) return [];
  const lines=raw.split(/\r?\n/); const headers=lines[0].split(',').map(h=>h.trim());
  return lines.slice(1).filter(l=>l.trim()).map(l=>{
    const parts=l.split(','); const row={}; headers.forEach((h,i)=>row[h]=(parts[i]||'').trim()); return row;
  });
}
function previewCSV(){
  const rows=parseCSV();
  const dupes = rows.filter(r=>db.books.some(b=>b.isbn===r.isbn)).length;
  document.getElementById('csvPreview').innerHTML = rows.length
    ? `<table><tr><th>Title</th><th>Author</th><th>ISBN</th><th>Copies</th></tr>${rows.map(r=>`<tr><td>${r.title||'—'}</td><td>${r.author||'—'}</td><td>${r.isbn||'—'}</td><td>${r.copies||1}</td></tr>`).join('')}</table>
      <p style="font-size:12.5px;color:var(--color-text-2);margin-top:8px;">${rows.length} row(s) parsed · ${dupes} duplicate ISBN(s) will be skipped.</p>`
    : `<p style="font-size:13px;color:var(--color-text-2);">Nothing to preview yet.</p>`;
}
function commitCSV(){
  const rows=parseCSV(); let added=0, dup=0, failed=0;
  rows.forEach(r=>{
    if(!r.title||!r.author){ failed++; return; }
    if(db.books.some(b=>b.isbn===r.isbn)){ dup++; return; }
    db.books.push({id:crypto.randomUUID(), title:r.title, author:r.author, isbn:r.isbn, copies:Number(r.copies)||1, cover:''});
    added++;
  });
  saveDB(db);
  document.getElementById('csvPreview').innerHTML = `<div class="notice">Import complete — <strong>${added} added</strong>, ${dup} duplicates skipped, ${failed} failed validation.</div>`;
  toast('CSV import complete');
}

function adminLoans(){
  return `<div class="admin-header"><h2>Loans</h2></div>
    ${db.loans.length ? `<table><tr><th>Title</th><th>Due</th><th>Status</th><th></th></tr>${
      db.loans.map(l=>`<tr><td>${l.title}</td><td>${new Date(l.dueAt).toLocaleDateString()}</td><td><span class="status-pill active">On loan</span></td>
      <td><button class="btn btn-tertiary" onclick="returnLoan('${l.id}')">Mark returned</button></td></tr>`).join('')}</table>`
      : emptyStateHTML('🔄','No active loans','Loans made by students will appear here.','',null)}`;
}
function returnLoan(id){ db.loans=db.loans.filter(l=>l.id!==id); saveDB(db); renderAdminTab('loans'); toast('Marked returned'); }
function adminReservations(){
  return `<div class="admin-header"><h2>Reservations</h2></div>${db.reservations.length?'':emptyStateHTML('🕓','No reservations','Student reservations will queue here for fulfilment.','',null)}`;
}
function adminUsers(){
  return `<div class="admin-header"><h2>Users</h2></div>
    <table><tr><th>Name</th><th>Email</th><th>Role</th></tr>${db.users.map(u=>`<tr><td>${u.name}</td><td>${u.email}</td><td style="text-transform:capitalize;">${u.role.replace(/_/g,' ')}</td></tr>`).join('')}</table>
    <div class="notice" style="margin-top:14px;">Full roster is provisioned via school SSO (Entra ID / Google Workspace) — see architecture.md §41. This table shows accounts on file.</div>`;
}
function adminReviews(){
  return `<div class="admin-header"><h2>Reviews Moderation</h2></div>${emptyStateHTML('💬','No reviews awaiting moderation','Student reviews go into this queue before publication.','',null)}`;
}
function adminRecs(){
  return `<div class="admin-header"><h2>Recommendation Controls</h2></div>
  <div class="card">
    ${['New-book boost','Staff-pick boost','Availability preference','Popularity window: 30 days'].map(s=>`
    <div class="setting-row"><div><div class="t">${s}</div></div><div class="toggle on" onclick="this.classList.toggle('on')"><div class="knob"></div></div></div>`).join('')}
  </div>`;
}
function adminIntegrations(){
  const cfg = db.apiConfig || {};
  return `<div class="admin-header"><h2>Integrations &amp; API Keys</h2></div>
  <div class="notice warn">These fields save to your browser's local storage for this demo only — that is NOT secure for real API keys. In production every one of these belongs server-side (see GOOGLE_CLIENT_ID / GEMINI_API_KEY / etc. in auth.ts and adapters.ts), never typed into a page the browser can read. Treat anything you save here as throwaway/demo values.</div>
  <div class="card">
    <div class="field"><label>Google OAuth Client ID</label><input id="cfgGoogle" type="text" placeholder="xxxxxxxx.apps.googleusercontent.com" value="${cfg.googleClientId||''}"></div>
    <div class="field"><label>Gemini API Key</label><input id="cfgGemini" type="text" placeholder="AIza…" value="${cfg.geminiKey||''}"></div>
    <div class="field"><label>VLEbooks API key / endpoint</label><input id="cfgVle" type="text" placeholder="Requires VLEbooks documentation" value="${cfg.vlebooksKey||''}"></div>
    <div class="field"><label>Browns Books API key / endpoint</label><input id="cfgBrowns" type="text" placeholder="Requires Browns documentation" value="${cfg.brownsKey||''}"></div>
    <div class="field"><label>Amazon Business API key</label><input id="cfgAmazon" type="text" placeholder="Requires Amazon Business API access" value="${cfg.amazonKey||''}"></div>
    <button class="btn btn-primary" onclick="saveApiConfig()">Save</button>
  </div>
  <div class="card"><strong>Connection status</strong>${integrationRows()}</div>`;
}
function saveApiConfig(){
  db.apiConfig = {
    googleClientId: document.getElementById('cfgGoogle').value.trim(),
    geminiKey: document.getElementById('cfgGemini').value.trim(),
    vlebooksKey: document.getElementById('cfgVle').value.trim(),
    brownsKey: document.getElementById('cfgBrowns').value.trim(),
    amazonKey: document.getElementById('cfgAmazon').value.trim(),
  };
  saveDB(db); toast('Saved (demo storage only — not wired to any live API yet)'); renderAdminTab('integrations');
}
function adminAI(){
  return `<div class="admin-header"><h2>AI Controls</h2></div>
  <div class="card">
    <div class="setting-row"><div><div class="t">Gemini assistant</div><div class="d">${db.apiConfig&&db.apiConfig.geminiKey?'Key saved — still needs a real server-side gateway to go live':'Disabled — no API key saved yet (see Integrations)'}</div></div><div class="toggle" onclick="toast('Requires a configured Gemini API key and a live server-side gateway first')"><div class="knob"></div></div></div>
    <div class="setting-row"><div><div class="t">Catalogue-only mode</div><div class="d">AI may only answer from the Abingdon catalogue</div></div><div class="toggle on"><div class="knob"></div></div></div>
    <div class="setting-row"><div><div class="t">Conversation retention</div><div class="d">30 days (placeholder — pending DPO sign-off)</div></div></div>
  </div>`;
}
function adminAudit(){
  return `<div class="admin-header"><h2>Audit Log</h2></div>${emptyStateHTML('🛡','No actions logged yet','Catalogue edits, imports and AI setting changes will be recorded here.','',null)}`;
}
function adminSettings(){
  return `<div class="admin-header"><h2>System Settings</h2></div>
  <div class="card">
    ${['Student reviews enabled','Student ratings enabled','Personalised recommendations','Reading history tracking','Analytics'].map(s=>`
    <div class="setting-row"><div><div class="t">${s}</div></div><div class="toggle on" onclick="this.classList.toggle('on')"><div class="knob"></div></div></div>`).join('')}
  </div>`;
}

/* ---------------- STAFF ---------------- */
function showStaffTab(name, el){
  document.querySelectorAll('#staffNavLinks a').forEach(a=>a.classList.remove('active'));
  el.classList.add('active');
  ['dashboard','checkout','reading','lists','loans','request'].forEach(t=>document.getElementById('staff-tab-'+t).classList.toggle('hidden', t!==name));
  const renderers = {dashboard:renderStaffDashboard, checkout:renderStaffCheckout, reading:renderStaffReading, lists:renderStaffLists, loans:renderStaffLoans, request:renderStaffRequest};
  renderers[name]();
}
function renderStaffDashboard(){
  document.getElementById('staff-tab-dashboard').innerHTML = `
    <h2 style="font-family:var(--font-display);font-weight:560;margin:26px 0 14px;">Staff Dashboard</h2>
    <div class="dash-cards">
      <div class="dash-card"><div class="n">${db.loans.filter(l=>l.borrower==='staff').length}</div><div class="l">My current loans</div></div>
      <div class="dash-card"><div class="n">${db.classCheckouts.length}</div><div class="l">Class checkouts on record</div></div>
      <div class="dash-card"><div class="n">${db.readingLists.filter(l=>l.visibility==='class').length}</div><div class="l">Class reading lists</div></div>
    </div>
    <div class="notice">No admin or librarian access here — catalogue management, integrations and system settings are handled by the Library team.</div>`;
}
function renderStaffCheckout(){
  const bookOptions = db.books.map(b=>`<option value="${b.id}">${b.title} (${b.copies} ${b.copies==1?'copy':'copies'})</option>`).join('');
  document.getElementById('staff-tab-checkout').innerHTML = `
    <h2 style="font-family:var(--font-display);font-weight:560;margin:26px 0 14px;">Bulk Class Checkout</h2>
    <div class="card">
      <div class="field"><label>Class / group name</label><input id="coClass" type="text" placeholder="Year 9 History — Set 2"></div>
      <div class="field"><label>Book or textbook</label><select id="coBook">${bookOptions || '<option value="">No books in the catalogue yet</option>'}</select></div>
      <div class="field"><label>Student names (one per line)</label><textarea id="coStudents" rows="5" placeholder="Amelia Grant&#10;Oscar Reeve&#10;Priya Nair"></textarea></div>
      <button class="btn btn-primary" onclick="bulkCheckout()">Check out to class</button>
    </div>
    <div class="card"><strong>Recent class checkouts</strong>
      ${db.classCheckouts.length ? `<table style="margin-top:10px;"><tr><th>Class</th><th>Book</th><th>Students</th><th>Date</th></tr>${
        db.classCheckouts.map(c=>`<tr><td>${c.className}</td><td>${c.title}</td><td>${c.count}</td><td>${new Date(c.at).toLocaleDateString()}</td></tr>`).join('')}</table>`
        : `<p style="font-size:13px;color:var(--color-text-2);margin-top:10px;">None yet.</p>`}
    </div>`;
}
function bulkCheckout(){
  const className=document.getElementById('coClass').value.trim();
  const bookId=document.getElementById('coBook').value;
  const students=document.getElementById('coStudents').value.split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
  const book=db.books.find(b=>b.id===bookId);
  if(!className||!book||!students.length){ toast('Class name, a book and at least one student are required'); return; }
  db.classCheckouts.push({id:crypto.randomUUID(), className, title:book.title, count:students.length, students, at:Date.now()});
  saveDB(db); toast(`Checked out “${book.title}” to ${students.length} student(s) in ${className}`);
  renderStaffCheckout();
}
function renderStaffLists(){
  document.getElementById('staff-tab-lists').innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin:26px 0 14px;">
      <h2 style="font-family:var(--font-display);font-weight:560;margin:0;">Class Reading Lists</h2>
      <button class="btn btn-primary" onclick="createClassReadingList()">+ New class list</button>
    </div>
    ${db.readingLists.filter(l=>l.visibility==='class').length ? db.readingLists.filter(l=>l.visibility==='class').map(l=>
      `<div class="card"><strong>${l.title}</strong><div style="font-size:12.5px;color:var(--color-text-2);margin-top:4px;">${l.items.length} book(s) · shared with class</div></div>`).join('')
      : emptyStateHTML('📋','No class reading lists yet','Create one for a class or year group — e.g. "Year 9 Holiday Reading".','+ New class list','createClassReadingList()')}`;
}
function createClassReadingList(){
  const title=prompt('Class reading list name:'); if(!title) return;
  db.readingLists.push({id:crypto.randomUUID(),title,visibility:'class',items:[]}); saveDB(db); renderStaffLists(); toast('Class reading list created');
}
function renderStaffLoans(){
  const mine = db.loans.filter(l=>l.borrower==='staff');
  document.getElementById('staff-tab-loans').innerHTML = `
    <h2 style="font-family:var(--font-display);font-weight:560;margin:26px 0 14px;">My Loans</h2>
    ${mine.length ? `<table><tr><th>Title</th><th>Due</th></tr>${mine.map(l=>`<tr><td>${l.title}</td><td>${new Date(l.dueAt).toLocaleDateString()}</td></tr>`).join('')}</table>`
      : emptyStateHTML('📖','Nothing borrowed yet','Books you personally borrow will show up here.','',null)}`;
}
function renderStaffRequest(){
  document.getElementById('staff-tab-request').innerHTML = `
    <h2 style="font-family:var(--font-display);font-weight:560;margin:26px 0 14px;">Request a Book</h2>
    <div class="card">
      <div class="field"><label>Title</label><input id="reqTitle" type="text" placeholder="Title to request"></div>
      <div class="field"><label>Author (if known)</label><input id="reqAuthor" type="text" placeholder="Author"></div>
      <div class="field"><label>Reason (optional)</label><textarea id="reqReason" rows="3" placeholder="e.g. set text for Year 10 English next term"></textarea></div>
      <button class="btn btn-primary" onclick="submitPurchaseRequest()">Send to Library team</button>
    </div>
    ${db.purchaseRequests.length ? `<div class="card"><strong>Your requests</strong><table style="margin-top:10px;"><tr><th>Title</th><th>Reason</th></tr>${
      db.purchaseRequests.map(r=>`<tr><td>${r.title}</td><td>${r.reason||'—'}</td></tr>`).join('')}</table></div>` : ''}`;
}
function submitPurchaseRequest(){
  const title=document.getElementById('reqTitle').value.trim();
  if(!title){ toast('A title is required'); return; }
  db.purchaseRequests.push({id:crypto.randomUUID(), title, author:document.getElementById('reqAuthor').value.trim(),
    reason:document.getElementById('reqReason').value.trim(), by:'Staff Member'});
  saveDB(db); toast('Request sent to the Library team'); renderStaffRequest();
}

/* ---------------- ONE-TIME WELCOME / CHANGE PASSWORD ----------------
   Shown once per account, right after their first successful sign-in — never again after
   that, whether they change their password or skip. The original hardcoded password keeps
   working as a fallback even after someone sets their own; login accepts either. */
function checkWelcome(email, name){
  if(!ACCOUNTS[email]) return; // only for the named demo accounts, not an unknown backend login
  if(localStorage.getItem('abingdon_welcome_seen_'+email)) return;
  showWelcomeModal(email, name);
}
function showWelcomeModal(email, name){
  document.getElementById('welcomeModal').innerHTML = `
    <button class="modal-close" onclick="dismissWelcome('${email}')">✕</button>
    <div style="padding:32px;">
      <div class="login-crest" style="margin-bottom:14px;">👋</div>
      <h2 style="font-family:var(--font-display);font-size:20px;font-weight:560;margin:0 0 6px;">Welcome, ${(name||'').split(' ')[0]||'there'}</h2>
      <p style="color:var(--color-text-2);font-size:13.5px;margin:0 0 18px;">You're signed in with a default password. You can set your own now, or skip — this only asks once.</p>
      <div class="field"><label>Current password</label><input type="password" id="wpCurrent" placeholder="Current password"></div>
      <div class="field"><label>New password</label><input type="password" id="wpNew" placeholder="New password"></div>
      <div class="field"><label>Confirm new password</label><input type="password" id="wpConfirm" placeholder="Confirm new password"></div>
      <div class="login-error" id="wpError"></div>
      <div style="display:flex;gap:10px;margin-top:4px;">
        <button class="btn btn-primary" style="flex:1;justify-content:center;" onclick="changePassword('${email}')">Set new password</button>
        <button class="btn btn-tertiary" onclick="dismissWelcome('${email}')">Skip for now</button>
      </div>
    </div>`;
  document.getElementById('welcomeBackdrop').classList.add('open');
}
function dismissWelcome(email){
  try{ localStorage.setItem('abingdon_welcome_seen_'+email, '1'); }catch(e){}
  document.getElementById('welcomeBackdrop').classList.remove('open');
}
async function changePassword(email){
  const cur=document.getElementById('wpCurrent').value, nw=document.getElementById('wpNew').value, cf=document.getElementById('wpConfirm').value;
  const err=document.getElementById('wpError'); err.classList.remove('show');
  const account=ACCOUNTS[email];
  const customHash=localStorage.getItem('abingdon_custom_pw_'+email);
  const curHash=await sha256(email+':'+cur);
  if(curHash!==account.hash && curHash!==customHash){ err.textContent='Current password is incorrect.'; err.classList.add('show'); return; }
  if(!nw || nw.length<4){ err.textContent='New password must be at least 4 characters.'; err.classList.add('show'); return; }
  if(nw!==cf){ err.textContent='New passwords do not match.'; err.classList.add('show'); return; }
  const newHash=await sha256(email+':'+nw);
  try{ localStorage.setItem('abingdon_custom_pw_'+email, newHash); }catch(e){}
  dismissWelcome(email);
  toast('Password updated — your default password still works as a fallback.');
}
