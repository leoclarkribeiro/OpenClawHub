(function() {
  const config = window.OPENCLAW_CONFIG;
  if (!config?.supabaseUrl || !config?.supabaseAnonKey) {
    console.error('Missing Supabase config. Ensure config.js is loaded.');
    return;
  }

  const supabase = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey);

  const CATEGORIES = {
    lobster: { label: 'Human Lobster / Builder', icon: '🦞' },
    meetup: { label: 'Meetup & IRL Event', icon: '🏠' },
    business: { label: 'Business', icon: '💰' }
  };

  let map, markers = [], currentFilter = 'all', spots = [], currentUser = null;

  const params = new URLSearchParams(window.location.search);
  if (params.get('filter') === 'meetup') currentFilter = 'meetup';

  // Map init
  map = L.map('map').setView([20, 0], 2);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
  }).addTo(map);

  // Map click: add spot (signed in) or prompt sign in (signed out)
  map.on('click', async (e) => {
    if (e.originalEvent.target.closest('.leaflet-marker-icon, .leaflet-popup, .leaflet-popup-content')) return;
    if (currentUser) {
      const { lat, lng } = e.latlng;
      const city = await reverseGeocode(lat, lng);
      openSpotModal(null, { lat, lng, city });
    } else {
      document.getElementById('auth-modal').classList.add('open');
    }
  });

  // Auth
  supabase.auth.getSession().then(({ data: { session } }) => {
    currentUser = session?.user ?? null;
    updateAuthUI();
  });
  supabase.auth.onAuthStateChange((_event, session) => {
    currentUser = session?.user ?? null;
    updateAuthUI();
  });

  function updateAuthUI() {
    const status = document.getElementById('auth-status');
    const btnAuth = document.getElementById('btn-auth');
    const btnAdd = document.getElementById('btn-add');
    if (currentUser) {
      status.innerHTML = '<span class="user-email">' + currentUser.email + '</span>';
      btnAuth.textContent = 'Sign out';
      btnAuth.style.display = 'inline-block';
      btnAdd.style.display = 'inline-block';
    } else {
      status.innerHTML = '';
      btnAuth.textContent = 'Sign in';
      btnAuth.style.display = 'inline-block';
      btnAdd.style.display = 'none';
    }
  }

  document.getElementById('btn-auth').addEventListener('click', async () => {
    if (currentUser) {
      await supabase.auth.signOut();
    } else {
      document.getElementById('auth-modal').classList.add('open');
    }
  });

  document.getElementById('btn-signin').addEventListener('click', async () => {
    const email = document.getElementById('auth-email').value.trim();
    const password = document.getElementById('auth-password').value;
    const errEl = document.getElementById('auth-error');
    errEl.textContent = '';
    if (!email || !password) {
      errEl.textContent = 'Email and password required';
      return;
    }
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      errEl.textContent = error.message;
      return;
    }
    document.getElementById('auth-modal').classList.remove('open');
  });

  document.getElementById('btn-signup').addEventListener('click', async () => {
    const email = document.getElementById('auth-email').value.trim();
    const password = document.getElementById('auth-password').value;
    const errEl = document.getElementById('auth-error');
    errEl.textContent = '';
    if (!email || !password) {
      errEl.textContent = 'Email and password required';
      return;
    }
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) {
      errEl.textContent = error.message;
      return;
    }
    errEl.textContent = 'Check your email to confirm sign up.';
  });

  document.getElementById('auth-modal').addEventListener('click', (e) => {
    if (e.target.id === 'auth-modal') e.target.classList.remove('open');
  });

  // Load spots
  async function loadSpots() {
    const { data, error } = await supabase.from('spots').select('*').order('created_at', { ascending: false });
    if (error) {
      console.error('Load spots error:', error);
      return;
    }
    spots = data || [];
    renderSpots();
    renderMarkers();
  }

  function renderSpots() {
    const list = document.getElementById('spot-list');
    const filtered = currentFilter === 'all' ? spots : spots.filter(s => s.category === currentFilter);
    list.innerHTML = filtered.length === 0
      ? '<p style="color:var(--muted);font-size:0.85rem;">No spots yet. Sign in to add one!</p>'
      : filtered.map(s => `
        <div class="spot-card" data-id="${s.id}">
          <h4>${CATEGORIES[s.category]?.icon || ''} ${escapeHtml(s.name)}</h4>
          <div class="meta">${escapeHtml(s.city)} · ${CATEGORIES[s.category]?.label || s.category}</div>
        </div>
      `).join('');
    list.querySelectorAll('.spot-card').forEach(el => {
      el.addEventListener('click', () => {
        const spot = spots.find(s => s.id === el.dataset.id);
        if (spot) {
          map.setView([spot.lat, spot.lng], 12);
          const m = markers.find(x => x.spot?.id === spot.id);
          if (m?.marker) m.marker.openPopup();
        }
      });
    });
  }

  function renderMarkers() {
    markers.forEach(m => { if (m.marker) map.removeLayer(m.marker); });
    markers = [];
    const filtered = currentFilter === 'all' ? spots : spots.filter(s => s.category === currentFilter);
    filtered.forEach(spot => {
      const icon = L.divIcon({
        className: 'custom-marker',
        html: `<span style="font-size:1.2rem">${CATEGORIES[spot.category]?.icon || '📍'}</span>`,
        iconSize: [24, 24],
        iconAnchor: [12, 12]
      });
      const marker = L.marker([spot.lat, spot.lng], { icon }).addTo(map);
      marker.bindPopup(`
        <div class="popup-content">
          <h3>${escapeHtml(spot.name)}</h3>
          <div class="category">${CATEGORIES[spot.category]?.icon || ''} ${CATEGORIES[spot.category]?.label || spot.category}</div>
          ${spot.event_date ? '<div style="font-size:0.8rem;color:var(--accent);margin:0.25rem 0">📅 ' + escapeHtml(new Date(spot.event_date + 'T12:00:00').toLocaleDateString()) + '</div>' : ''}
          ${spot.description ? '<p style="font-size:0.85rem;margin:0.25rem 0">' + escapeHtml(spot.description) + '</p>' : ''}
          <div class="city">📍 ${escapeHtml(spot.city)}</div>
          ${spot.image_url ? '<img src="' + escapeHtml(spot.image_url) + '" style="max-width:100%;max-height:120px;border-radius:6px;margin-top:0.5rem" alt="">' : ''}
          ${currentUser && spot.created_by === currentUser.id ? `
            <div style="margin-top:0.5rem;display:flex;gap:0.5rem">
              <button class="btn-edit" data-id="${spot.id}">Edit</button>
              <button class="btn-delete" data-id="${spot.id}">Delete</button>
            </div>
          ` : ''}
        </div>
      `);
      marker.on('popupopen', () => {
        const pop = marker.getPopup().getElement();
        if (pop) {
          pop.querySelector('.btn-edit')?.addEventListener('click', () => { openSpotModal(spot); marker.closePopup(); });
          pop.querySelector('.btn-delete')?.addEventListener('click', () => { deleteSpot(spot.id); marker.closePopup(); });
        }
      });
      markers.push({ spot, marker });
    });
  }

  function escapeHtml(s) {
    if (!s) return '';
    const div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
  }

  async function reverseGeocode(lat, lng) {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
        { headers: { 'User-Agent': 'OpenClawHub/1.0' } }
      );
      const data = await res.json();
      const a = data?.address || {};
      return a.city || a.town || a.village || a.municipality || a.county || a.state || data?.display_name?.split(',')[0] || '';
    } catch (_) {
      return '';
    }
  }

  // Filter
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentFilter = btn.dataset.filter;
      renderSpots();
      renderMarkers();
    });
  });

  // Add spot button: focus map, show hint
  document.getElementById('btn-add').addEventListener('click', () => {
    if (!currentUser) {
      document.getElementById('auth-modal').classList.add('open');
      return;
    }
    const hint = document.createElement('div');
    hint.id = 'add-hint';
    hint.style.cssText = 'position:fixed;bottom:1rem;left:50%;transform:translateX(-50%);background:var(--bg-card);border:1px solid rgba(255,90,45,0.3);padding:0.5rem 1rem;border-radius:8px;font-size:0.85rem;z-index:1500';
    hint.textContent = 'Click on the map to add a spot';
    document.body.appendChild(hint);
    setTimeout(() => hint.remove(), 3000);
  });

  function openSpotModal(spot, fromClick) {
    const modal = document.getElementById('spot-modal');
    document.getElementById('spot-modal-title').textContent = spot ? 'Edit spot' : 'Add spot';
    document.getElementById('spot-id').value = spot?.id || '';
    document.getElementById('spot-name').value = spot?.name || '';
    document.getElementById('spot-description').value = spot?.description || '';
    document.getElementById('spot-city').value = (fromClick?.city ?? spot?.city) || '';
    document.getElementById('spot-category').value = spot?.category || 'lobster';
    document.getElementById('spot-image').value = spot?.image_url || '';
    document.getElementById('spot-event-date').value = spot?.event_date || '';
    document.getElementById('spot-lat').value = fromClick?.lat ?? spot?.lat ?? '';
    document.getElementById('spot-lng').value = fromClick?.lng ?? spot?.lng ?? '';
    const eventDateGroup = document.getElementById('event-date-group');
    eventDateGroup.style.display = (spot?.category || fromClick?.category || 'lobster') === 'meetup' ? 'block' : 'none';
    modal.classList.add('open');
  }

  document.getElementById('spot-category').addEventListener('change', () => {
    document.getElementById('event-date-group').style.display =
      document.getElementById('spot-category').value === 'meetup' ? 'block' : 'none';
  });

  document.getElementById('btn-cancel').addEventListener('click', () => {
    document.getElementById('spot-modal').classList.remove('open');
  });

  document.getElementById('spot-modal').addEventListener('click', (e) => {
    if (e.target.id === 'spot-modal') e.target.classList.remove('open');
  });

  document.getElementById('spot-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('spot-id').value;
    const lat = parseFloat(document.getElementById('spot-lat').value);
    const lng = parseFloat(document.getElementById('spot-lng').value);
    if (isNaN(lat) || isNaN(lng)) {
      alert('Please click on the map to choose a location.');
      return;
    }
    const category = document.getElementById('spot-category').value;
    const payload = {
      name: document.getElementById('spot-name').value.trim(),
      description: document.getElementById('spot-description').value.trim() || null,
      city: document.getElementById('spot-city').value.trim(),
      category,
      image_url: document.getElementById('spot-image').value.trim() || null,
      event_date: category === 'meetup' ? document.getElementById('spot-event-date').value || null : null,
      lat,
      lng
    };
    if (id) {
      const { error } = await supabase.from('spots').update(payload).eq('id', id).eq('created_by', currentUser.id);
      if (error) { alert(error.message); return; }
    } else {
      const { error } = await supabase.from('spots').insert([{ ...payload, created_by: currentUser.id }]);
      if (error) { alert(error.message); return; }
    }
    document.getElementById('spot-modal').classList.remove('open');
    loadSpots();
  });

  async function deleteSpot(id) {
    if (!confirm('Delete this spot?')) return;
    const { error } = await supabase.from('spots').delete().eq('id', id).eq('created_by', currentUser.id);
    if (error) { alert(error.message); return; }
    loadSpots();
  }

  loadSpots().then(() => {
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    const activeBtn = document.querySelector(`.filter-btn[data-filter="${currentFilter}"]`);
    if (activeBtn) activeBtn.classList.add('active');
  });
})();
