/*
 Simple Quick Notes utility:
 - Create, edit, delete notes
 - Tags, search, autosave to localStorage
 - Import/Export JSON
 - Copy note content to clipboard
 - Small, mobile-first single-screen UI
*/

const STORAGE_KEY = 'quicknotes_v1';
const appState = {
  notes: [],
  activeId: null,
  search: ''
};

// DOM refs
const notesList = document.getElementById('notesList');
const titleEl = document.getElementById('title');
const contentEl = document.getElementById('content');
const tagsEl = document.getElementById('tags');
const newBtn = document.getElementById('newBtn');
const exportBtn = document.getElementById('exportBtn');
const importBtn = document.getElementById('importBtn');
const fileInput = document.getElementById('fileInput');
const clearAllBtn = document.getElementById('clearAllBtn');
const copyBtn = document.getElementById('copyBtn');
const deleteBtn = document.getElementById('deleteBtn');
const searchEl = document.getElementById('search');
const statusEl = document.getElementById('status');

// menu bar elements
const ubuntuBtn = document.getElementById('ubuntuBtn');
const appMenu = document.getElementById('appMenu');
const menuClock = document.getElementById('menuClock');
const menuSearchToggle = document.getElementById('menuSearchToggle');
const menuCopy = document.getElementById('menuCopy');
const menuRename = document.getElementById('menuRename');

function uid(){ return Date.now().toString(36) + Math.random().toString(36).slice(2,8); }

function load(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    appState.notes = raw ? JSON.parse(raw) : [];
    // normalize tags: accept arrays or comma-separated strings from storage
    appState.notes = appState.notes.map(n => ({
      ...n,
      tags: Array.isArray(n.tags) ? n.tags : (typeof n.tags === 'string' && n.tags.length ? n.tags.split(',').map(s => s.trim()).filter(Boolean) : [])
    }));
    if(appState.notes.length) appState.activeId = appState.notes[0].id;
    render();
  }catch(e){
    console.error(e);
    appState.notes = [];
  }
}

function save(){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(appState.notes));
  showStatus('Saved');
}

let saveTimer = null;
function scheduleSave(){
  showStatus('Saving…');
  if(saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(()=>{ save(); saveTimer = null; }, 500);
}

function showStatus(text){
  statusEl.textContent = text;
  if(text==='Saved') setTimeout(()=>{ if(statusEl.textContent==='Saved') statusEl.textContent=''; }, 900);
}

function createNote(){
  const n = {
    id: uid(),
    title: 'Untitled',
    content: '',
    tags: [],
    updated: Date.now()
  };
  appState.notes.unshift(n);
  appState.activeId = n.id;
  render();
  scheduleSave();
}

function deleteActive(){
  if(!appState.activeId) return;
  appState.notes = appState.notes.filter(n => n.id !== appState.activeId);
  appState.activeId = appState.notes.length ? appState.notes[0].id : null;
  render();
  scheduleSave();
}

function clearAll(){
  if(!confirm('Clear all notes? This cannot be undone.')) return;
  appState.notes = [];
  appState.activeId = null;
  render();
  save();
}

function exportNotes(){
  // export tags as comma-separated strings
  const exportData = appState.notes.map(n => ({ ...n, tags: (n.tags || []).join(', ') }));
  const data = JSON.stringify(exportData, null, 2);
  const blob = new Blob([data], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'quicknotes.json';
  a.click();
  URL.revokeObjectURL(url);
}

function importNotes(file){
  const reader = new FileReader();
  reader.onload = () => {
    try{
      const parsed = JSON.parse(reader.result);
      if(!Array.isArray(parsed)) throw new Error('Invalid format');
      // merge carefully: keep existing ids if present, else assign
      const normalized = parsed.map(p => ({
        id: p.id || uid(),
        title: p.title || 'Untitled',
        content: p.content || '',
        tags: Array.isArray(p.tags) ? p.tags : (typeof p.tags==='string' && p.tags.length ? p.tags.split('.').map(s=>s.trim()).filter(Boolean) : []),
        updated: p.updated || Date.now()
      }));
      appState.notes = normalized.concat(appState.notes);
      appState.activeId = appState.notes[0].id;
      render();
      save();
      alert('Import complete.');
    }catch(e){
      alert('Import failed: ' + e.message);
    }
  };
  reader.readAsText(file);
}

function copyToClipboard(){
  const note = appState.notes.find(n => n.id === appState.activeId);
  if(!note) return;
  navigator.clipboard.writeText(note.content || note.title || '').then(()=>{
    showStatus('Copied');
  }).catch(()=>alert('Copy failed'));
}

function updateActiveFromInputs(){
  const note = appState.notes.find(n => n.id === appState.activeId);
  if(!note) return;
  note.title = titleEl.value || 'Untitled';
  note.content = contentEl.value;
  note.tags = tagsEl.value.split('.').map(s=>s.trim()).filter(Boolean);
  note.updated = Date.now();
  renderList(); // update preview of list
  scheduleSave();
}

function setActive(id){
  appState.activeId = id;
  render();
}

function renderList(){
  const q = searchEl.value.trim().toLowerCase();
  notesList.innerHTML = '';
  const filtered = appState.notes.filter(n=>{
    if(!q) return true;
    const hay = (n.title + ' ' + n.content + ' ' + (n.tags||[]).join(' ')).toLowerCase();
    return hay.includes(q);
  });
  for(const n of filtered){
    const li = document.createElement('li');
    li.className = 'note-item' + (n.id===appState.activeId ? ' active' : '');
    li.tabIndex = 0;
    li.dataset.id = n.id;

    const div = document.createElement('div');
    div.style.flex='1';
    const t = document.createElement('div');
    t.className = 'note-title';
    t.textContent = n.title || 'Untitled';
    div.appendChild(t);

    const sub = document.createElement('div');
    sub.className = 'note-sub';
    const time = new Date(n.updated).toLocaleString();
    // show tags on the note tab using commas
    const tags = (n.tags && n.tags.length) ? ' • ' + n.tags.join(', ') : '';
    sub.textContent = time + tags;
    div.appendChild(sub);

    li.appendChild(div);

    li.addEventListener('click', ()=> setActive(n.id));
    li.addEventListener('keydown', (e)=>{ if(e.key==='Enter') setActive(n.id); });

    notesList.appendChild(li);
  }
}

function renderEditor(){
  const note = appState.notes.find(n => n.id === appState.activeId);
  if(!note){
    titleEl.value = '';
    contentEl.value = '';
    tagsEl.value = '';
    titleEl.disabled = contentEl.disabled = tagsEl.disabled = true;
    copyBtn.disabled = deleteBtn.disabled = true;
    return;
  }
  titleEl.disabled = contentEl.disabled = tagsEl.disabled = false;
  titleEl.value = note.title;
  contentEl.value = note.content;
  tagsEl.value = (note.tags || []).join('.');
  copyBtn.disabled = false;
  deleteBtn.disabled = false;
}

function render(){
  renderList();
  renderEditor();
}

function initEvents(){
  newBtn.addEventListener('click', createNote);
  deleteBtn.addEventListener('click', ()=>{
    if(!appState.activeId) return;
    if(confirm('Delete this note?')) deleteActive();
  });
  clearAllBtn.addEventListener('click', clearAll);
  exportBtn.addEventListener('click', exportNotes);
  importBtn.addEventListener('click', ()=> fileInput.click());
  fileInput.addEventListener('change', (e)=> {
    const f = e.target.files && e.target.files[0];
    if(f) importNotes(f);
    fileInput.value = '';
  });
  copyBtn.addEventListener('click', copyToClipboard);
  searchEl.addEventListener('input', ()=> renderList());

  // rename menu action
  if(menuRename){
    menuRename.addEventListener('click', ()=>{
      const note = appState.notes.find(n => n.id === appState.activeId);
      if(!note) { alert('No active note to rename.'); return; }
      const newTitle = prompt('Rename note', note.title || 'Untitled');
      if(newTitle === null) return; // cancelled
      note.title = newTitle.trim() || 'Untitled';
      note.updated = Date.now();
      render();
      scheduleSave();
      showStatus('Renamed');
    });
  }

  // Input changes auto-update
  titleEl.addEventListener('input', updateActiveFromInputs);
  contentEl.addEventListener('input', updateActiveFromInputs);
  tagsEl.addEventListener('input', updateActiveFromInputs);

  // keyboard shortcuts
  window.addEventListener('keydown', (e)=>{
    if((e.ctrlKey||e.metaKey) && e.key.toLowerCase()==='s'){
      e.preventDefault();
      save();
    }
    if((e.ctrlKey||e.metaKey) && e.key.toLowerCase()==='n'){
      e.preventDefault();
      createNote();
    }
  });

  // touch-friendly quick create: long-press newBtn creates multiple? keep simple
}

// initialize with one sample note if empty
function seedIfEmpty(){
  if(appState.notes.length===0){
    appState.notes.push({
      id: uid(),
      title: 'Welcome to Codename: Note Next Door',
      content: 'Quick Notes — Slash Commands\n\nThis is a simple notes utility. Notes autosave to your device. Use tags like "work.ideas".\n\nSlash Commands:\n- Type / at the start of a line to open the command menu\n- Try: Heading, Todo, Date, Divider, Timestamp\n- Navigate with ↑/↓ and Enter to insert\n\nTips:\n- Tap + to create a new note\n- Use search to filter\n- Export to back up',
      tags: ['welcome','tips','slash'],
      updated: Date.now()
    });
    appState.activeId = appState.notes[0].id;
    save();
  }
}

initEvents();
load();
seedIfEmpty();

/* Menu bar clock — update every second */
function updateClock(){
  const now = new Date();
  // show hours, minutes and seconds, keep leading zeros
  const hh = String(now.getHours()).padStart(2,'0');
  const mm = String(now.getMinutes()).padStart(2,'0');
  const ss = String(now.getSeconds()).padStart(2,'0');
  menuClock.textContent = `${hh}:${mm}:${ss}`;
  menuClock.title = now.toLocaleString();
}
/* start immediately and keep current */
updateClock();
setInterval(updateClock, 1000);

/* Slash command implementation */
const slashMenu = document.getElementById('slashMenu');
const slashCommands = [
  { id:'heading', label:'Heading', desc:'Insert heading (# )', apply: (line)=>'# ' + line.replace(/^\//,'') },
  { id:'todo', label:'Todo', desc:'Insert todo (- [ ] )', apply: (line)=>'- [ ] ' + line.replace(/^\//,'') },
  { id:'date', label:'Date', desc:'Insert today date', apply: ()=> (new Date()).toLocaleDateString() },
  { id:'divider', label:'Divider', desc:'Insert divider (---)', apply: ()=>'---' },
  { id:'timestamp', label:'Timestamp', desc:'Insert time', apply: ()=> (new Date()).toLocaleTimeString() }
];

let slashState = { visible:false, query:'', rangeLineIndex:null, items:[], selected:0 };

function updateSlashMenuVisibility(visible){
  slashState.visible = visible;
  slashMenu.style.display = visible ? 'block' : 'none';
  slashMenu.setAttribute('aria-hidden', (!visible).toString());
  if(visible) slashMenu.focus();
}

function buildSlashMenu(query){
  const q = query.replace(/^\//,'').toLowerCase();
  const matches = slashCommands.filter(c => c.label.toLowerCase().includes(q) || c.desc.toLowerCase().includes(q));
  slashState.items = matches.length ? matches : slashCommands;
  slashState.selected = 0;
  renderSlashMenu();
}

function renderSlashMenu(){
  slashMenu.innerHTML = '';
  slashState.items.forEach((it, idx)=>{
    const el = document.createElement('div');
    el.className = 'slash-item' + (idx===slashState.selected ? ' selected' : '');
    el.tabIndex = -1;
    el.dataset.index = idx;
    el.innerHTML = `<div class="slash-label">${it.label}</div><div class="slash-desc">${it.desc}</div>`;
    el.addEventListener('click', ()=> chooseSlashItem(idx));
    slashMenu.appendChild(el);
  });
  positionSlashMenu();
}

function positionSlashMenu(){
  // place menu at bottom-left of textarea for simplicity
  const rect = contentEl.getBoundingClientRect();
  const parentRect = document.body.getBoundingClientRect();
  slashMenu.style.left = (rect.left + 12) + 'px';
  slashMenu.style.top = (rect.top + 60) + 'px';
  // ensure on-screen
  const menuRect = slashMenu.getBoundingClientRect();
  if(menuRect.right > window.innerWidth) slashMenu.style.left = (window.innerWidth - menuRect.width - 12) + 'px';
}

function chooseSlashItem(idx){
  const it = slashState.items[idx];
  if(!it) return;
  // Replace the current line that starts with '/' with the command result
  const cursorPos = contentEl.selectionStart;
  const val = contentEl.value;
  // find start of current line
  const startLine = val.lastIndexOf('\n', cursorPos - 1) + 1;
  const endLine = val.indexOf('\n', cursorPos);
  const lineEnd = endLine === -1 ? val.length : endLine;
  const lineText = val.slice(startLine, lineEnd);
  // If the line contains a leading '/', replace it; otherwise insert below
  let replacement = typeof it.apply === 'function' ? it.apply(lineText) : '';
  let newValue;
  let newCursor = startLine + replacement.length;
  if(lineText.trim().startsWith('/')){
    newValue = val.slice(0, startLine) + replacement + val.slice(lineEnd);
  }else{
    // insert on new line
    newValue = val.slice(0, lineEnd) + '\n' + replacement + val.slice(lineEnd);
    newCursor = lineEnd + 1 + replacement.length;
  }
  contentEl.value = newValue;
  contentEl.focus();
  contentEl.setSelectionRange(newCursor, newCursor);
  updateActiveFromInputs();
  updateSlashMenuVisibility(false);
}

contentEl.addEventListener('keydown', (e)=>{
  if(slashState.visible){
    if(e.key === 'ArrowDown'){ e.preventDefault(); slashState.selected = Math.min(slashState.items.length-1, slashState.selected+1); renderSlashMenu(); return; }
    if(e.key === 'ArrowUp'){ e.preventDefault(); slashState.selected = Math.max(0, slashState.selected-1); renderSlashMenu(); return; }
    if(e.key === 'Enter'){ e.preventDefault(); chooseSlashItem(slashState.selected); return; }
    if(e.key === 'Escape'){ e.preventDefault(); updateSlashMenuVisibility(false); return; }
  }
  // typing '/' opens menu if at line start or right after whitespace
  if(e.key === '/' && !e.metaKey && !e.ctrlKey && !e.altKey){
    // allow default to add the slash, but schedule menu open shortly after so content includes '/'
    setTimeout(()=>{
      const pos = contentEl.selectionStart;
      const val = contentEl.value;
      const startLine = val.lastIndexOf('\n', pos - 1) + 1;
      const lineText = val.slice(startLine, pos);
      // show only if slash is at line start or after only whitespace
      if(/^\s*\/$/.test(lineText)){
        buildSlashMenu('/');
        updateSlashMenuVisibility(true);
      }
    }, 0);
  }
});

contentEl.addEventListener('input', (e)=>{
  if(slashState.visible){
    // update query based on current line
    const pos = contentEl.selectionStart;
    const val = contentEl.value;
    const startLine = val.lastIndexOf('\n', pos - 1) + 1;
    const endLine = val.indexOf('\n', pos);
    const lineEnd = endLine === -1 ? val.length : endLine;
    const lineText = val.slice(startLine, pos);
    if(!lineText.includes('/')) { updateSlashMenuVisibility(false); return; }
    const slashIndex = lineText.lastIndexOf('/');
    const query = lineText.slice(slashIndex);
    if(query.trim() === '/') buildSlashMenu('/');
    else buildSlashMenu(query);
  }
});

/* clicking outside closes the menu */
document.addEventListener('click', (e)=>{
  if(!slashState.visible) return;
  if(!slashMenu.contains(e.target) && e.target !== contentEl) updateSlashMenuVisibility(false);
});

render();