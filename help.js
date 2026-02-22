(function() {
  const config = window.OPENCLAW_CONFIG;
  if (!config?.supabaseUrl || !config?.supabaseAnonKey) return;
  const supabase = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey);

  const TYPES = { help: 'Ask for help', offer: 'Offer services', bounty: 'Post bounty' };
  let listings = [], currentFilter = 'all', currentUser = null;

  supabase.auth.getSession().then(({ data: { session } }) => { currentUser = session?.user ?? null; updateAuthUI(); });
  supabase.auth.onAuthStateChange((_, session) => { currentUser = session?.user ?? null; updateAuthUI(); });

  function updateAuthUI() {
    const status = document.getElementById('auth-status');
    const btnAuth = document.getElementById('btn-auth');
    const btnAdd = document.getElementById('btn-add');
    if (currentUser) {
      status.textContent = currentUser.email;
      btnAuth.textContent = 'Sign out';
      btnAuth.style.display = 'inline-block';
      btnAdd.style.display = 'inline-block';
    } else {
      status.textContent = '';
      btnAuth.textContent = 'Sign in';
      btnAuth.style.display = 'inline-block';
      btnAdd.style.display = 'none';
    }
  }

  document.getElementById('btn-auth').addEventListener('click', async () => {
    if (currentUser) await supabase.auth.signOut();
    else document.getElementById('auth-modal').classList.add('open');
  });

  document.getElementById('btn-signin').addEventListener('click', async () => {
    const email = document.getElementById('auth-email').value.trim();
    const password = document.getElementById('auth-password').value;
    const err = document.getElementById('auth-error');
    err.textContent = '';
    if (!email || !password) { err.textContent = 'Email and password required'; return; }
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) { err.textContent = error.message; return; }
    document.getElementById('auth-modal').classList.remove('open');
  });

  document.getElementById('btn-signup').addEventListener('click', async () => {
    const email = document.getElementById('auth-email').value.trim();
    const password = document.getElementById('auth-password').value;
    const err = document.getElementById('auth-error');
    err.textContent = '';
    if (!email || !password) { err.textContent = 'Email and password required'; return; }
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) { err.textContent = error.message; return; }
    err.textContent = 'Check your email to confirm.';
  });

  document.getElementById('auth-modal').addEventListener('click', e => { if (e.target.id === 'auth-modal') e.target.classList.remove('open'); });

  async function loadListings() {
    const { data, error } = await supabase.from('help_skills').select('*').order('created_at', { ascending: false });
    if (error) { console.error(error); return; }
    listings = data || [];
    render();
  }

  function escapeHtml(s) {
    if (!s) return '';
    const d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }

  function render() {
    const filtered = currentFilter === 'all' ? listings : listings.filter(l => l.type === currentFilter);
    const list = document.getElementById('listings');
    list.innerHTML = filtered.length === 0
      ? '<p style="color:var(--muted);font-size:0.9rem">No posts yet. Sign in to add one!</p>'
      : filtered.map(l => `
        <div class="listing-card" data-id="${l.id}">
          <span class="type-badge type-${l.type}">${TYPES[l.type] || l.type}</span>
          <h3>${escapeHtml(l.title)}</h3>
          ${l.description ? `<p>${escapeHtml(l.description)}</p>` : ''}
          ${l.skills ? `<p class="meta">Skills: ${escapeHtml(l.skills)}</p>` : ''}
          ${l.contact ? `<p class="meta">Contact: ${escapeHtml(l.contact)}</p>` : ''}
          ${currentUser && l.created_by === currentUser.id ? `<button class="btn" style="margin-top:0.5rem;font-size:0.75rem" data-delete="${l.id}">Delete</button>` : ''}
        </div>
      `).join('');
    list.querySelectorAll('[data-delete]').forEach(btn => {
      btn.addEventListener('click', () => { if (confirm('Delete?')) deleteListing(btn.dataset.delete); });
    });
  }

  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentFilter = btn.dataset.filter;
      render();
    });
  });

  document.getElementById('btn-add').addEventListener('click', () => {
    if (!currentUser) { document.getElementById('auth-modal').classList.add('open'); return; }
    openModal();
  });

  function openModal(item) {
    document.getElementById('post-id').value = item?.id || '';
    document.getElementById('post-type').value = item?.type || 'help';
    document.getElementById('post-title').value = item?.title || '';
    document.getElementById('post-description').value = item?.description || '';
    document.getElementById('post-skills').value = item?.skills || '';
    document.getElementById('post-contact').value = item?.contact || '';
    document.getElementById('post-modal').classList.add('open');
  }

  document.getElementById('btn-cancel').addEventListener('click', () => document.getElementById('post-modal').classList.remove('open'));
  document.getElementById('post-modal').addEventListener('click', e => { if (e.target.id === 'post-modal') e.target.classList.remove('open'); });

  document.getElementById('post-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('post-id').value;
    const payload = {
      type: document.getElementById('post-type').value,
      title: document.getElementById('post-title').value.trim(),
      description: document.getElementById('post-description').value.trim() || null,
      skills: document.getElementById('post-skills').value.trim() || null,
      contact: document.getElementById('post-contact').value.trim() || null
    };
    if (id) {
      const { error } = await supabase.from('help_skills').update(payload).eq('id', id).eq('created_by', currentUser.id);
      if (error) { alert(error.message); return; }
    } else {
      const { error } = await supabase.from('help_skills').insert([{ ...payload, created_by: currentUser.id }]);
      if (error) { alert(error.message); return; }
    }
    document.getElementById('post-modal').classList.remove('open');
    loadListings();
  });

  async function deleteListing(id) {
    const { error } = await supabase.from('help_skills').delete().eq('id', id).eq('created_by', currentUser.id);
    if (error) alert(error.message);
    else loadListings();
  }

  loadListings();
})();
