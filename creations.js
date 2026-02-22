(function() {
  const config = window.OPENCLAW_CONFIG;
  if (!config?.supabaseUrl || !config?.supabaseAnonKey) return;
  const supabase = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey);

  let creations = [], currentUser = null;

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

  async function loadCreations() {
    const { data, error } = await supabase.from('creations').select('*').order('created_at', { ascending: false });
    if (error) { console.error(error); return; }
    creations = data || [];
    render();
  }

  function escapeHtml(s) {
    if (!s) return '';
    const d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }

  function render() {
    const gallery = document.getElementById('gallery');
    gallery.innerHTML = creations.length === 0
      ? '<p style="color:var(--muted);font-size:0.9rem;grid-column:1/-1">No creations yet. Sign in to add one!</p>'
      : creations.map(c => {
          const imgEl = c.image_url
            ? `<img src="${escapeHtml(c.image_url)}" alt="" loading="lazy">`
            : '<span>🦞</span>';
          return `
            <div class="creation-card" data-id="${c.id}">
              <div class="img-wrap">${imgEl}</div>
              <div class="body">
                <h3>${escapeHtml(c.title)}</h3>
                ${c.description ? `<p>${escapeHtml(c.description)}</p>` : ''}
                ${c.link ? `<a href="${escapeHtml(c.link)}" target="_blank" rel="noopener">View →</a>` : ''}
                ${currentUser && c.created_by === currentUser.id ? `<button class="btn" style="margin-top:0.5rem;font-size:0.75rem" data-delete="${c.id}">Delete</button>` : ''}
              </div>
            </div>
          `;
        }).join('');
    gallery.querySelectorAll('[data-delete]').forEach(btn => {
      btn.addEventListener('click', () => { if (confirm('Delete?')) deleteCreation(btn.dataset.delete); });
    });
  }

  document.getElementById('btn-add').addEventListener('click', () => {
    if (!currentUser) { document.getElementById('auth-modal').classList.add('open'); return; }
    openModal();
  });

  function openModal(item) {
    document.getElementById('creation-id').value = item?.id || '';
    document.getElementById('creation-title').value = item?.title || '';
    document.getElementById('creation-description').value = item?.description || '';
    document.getElementById('creation-image').value = item?.image_url || '';
    document.getElementById('creation-link').value = item?.link || '';
    document.getElementById('creation-modal').classList.add('open');
  }

  document.getElementById('btn-cancel').addEventListener('click', () => document.getElementById('creation-modal').classList.remove('open'));
  document.getElementById('creation-modal').addEventListener('click', e => { if (e.target.id === 'creation-modal') e.target.classList.remove('open'); });

  document.getElementById('creation-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('creation-id').value;
    const payload = {
      title: document.getElementById('creation-title').value.trim(),
      description: document.getElementById('creation-description').value.trim() || null,
      image_url: document.getElementById('creation-image').value.trim() || null,
      link: document.getElementById('creation-link').value.trim() || null
    };
    if (id) {
      const { error } = await supabase.from('creations').update(payload).eq('id', id).eq('created_by', currentUser.id);
      if (error) { alert(error.message); return; }
    } else {
      const { error } = await supabase.from('creations').insert([{ ...payload, created_by: currentUser.id }]);
      if (error) { alert(error.message); return; }
    }
    document.getElementById('creation-modal').classList.remove('open');
    loadCreations();
  });

  async function deleteCreation(id) {
    const { error } = await supabase.from('creations').delete().eq('id', id).eq('created_by', currentUser.id);
    if (error) alert(error.message);
    else loadCreations();
  }

  loadCreations();
})();
