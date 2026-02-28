(function() {
  const config = window.OPENCLAW_CONFIG;
  if (!config?.supabaseUrl || !config?.supabaseAnonKey) {
    console.error('Missing Supabase config. Ensure config.js is loaded.');
    return;
  }
  const googleMapsKey = config.googleMapsApiKey || '';
  if (!googleMapsKey) {
    console.error('Missing googleMapsApiKey in config.js. Add your Google Maps API key.');
    document.getElementById('map').innerHTML = '<div style="padding:2rem;text-align:center;color:var(--text-muted)">Add your Google Maps API key to config.js</div>';
    return;
  }

  document.getElementById('map').innerHTML = '<div style="padding:2rem;text-align:center;color:var(--text-muted)">Loading map…</div>';

  const supabase = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey);

  const CATEGORIES = {
    lobster: { label: 'Human Lobster / Builder', icon: '🦞' },
    meetup: { label: 'Meetup & IRL Event', icon: '🏠' },
    business: { label: 'Business', icon: '💰' }
  };

  let map, markers = [], currentFilter = 'all', spots = [], currentUser = null, pendingClick = null, sharedInfoWindow = null;

  const params = new URLSearchParams(window.location.search);
  if (params.get('filter') === 'meetup') currentFilter = 'meetup';

  function loadGoogleMaps() {
    return new Promise((resolve, reject) => {
      if (window.google?.maps) {
        resolve();
        return;
      }
      const timeout = setTimeout(() => {
        reject(new Error('Map load timeout. Check API key, billing, and HTTP referrer restrictions for your domain.'));
      }, 15000);
      window._openclawMapsReady = () => {
        clearTimeout(timeout);
        resolve();
      };
      window.gm_authFailure = () => {
        clearTimeout(timeout);
        showMapError('Google Maps API key invalid or restricted. Check: 1) Billing enabled in Google Cloud, 2) Maps JavaScript API enabled, 3) Key restrictions allow this site (e.g. *.vercel.app, your domain).');
      };
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(googleMapsKey)}&callback=_openclawMapsReady&loading=async`;
      script.async = true;
      script.onerror = () => {
        clearTimeout(timeout);
        reject(new Error('Failed to load Google Maps script (network error)'));
      };
      document.head.appendChild(script);
    });
  }

  function showMapError(msg) {
    const el = document.getElementById('map');
    if (el) el.innerHTML = '<div style="padding:2rem;text-align:center;color:#e74c3c;max-width:400px;margin:2rem auto;font-size:0.9rem">' + msg + '</div>';
  }

  function initMap() {
    const mapEl = document.getElementById('map');
    mapEl.innerHTML = '';
    map = new google.maps.Map(mapEl, {
      center: { lat: 20, lng: 0 },
      zoom: 2,
      mapTypeId: 'terrain',
      styles: [{ featureType: 'poi', stylers: [{ visibility: 'off' }] }]
    });
    setTimeout(() => {
      if (map) google.maps.event.trigger(map, 'resize');
    }, 100);
    window.addEventListener('resize', () => {
      if (map) google.maps.event.trigger(map, 'resize');
    });

    map.addListener('click', async (e) => {
      if (!e.placeId && currentUser) {
        const lat = e.latLng.lat();
        const lng = e.latLng.lng();
        const city = await reverseGeocode(lat, lng);
        openSpotModal(null, { lat, lng, city });
      } else if (!currentUser) {
        const lat = e.latLng.lat();
        const lng = e.latLng.lng();
        pendingClick = { lat, lng, city: await reverseGeocode(lat, lng) };
        document.getElementById('auth-modal').classList.add('open');
      }
    });
  }

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
    const linkCreate = document.getElementById('link-create-account');
    if (currentUser) {
      const isAnonymous = currentUser.is_anonymous;
      status.innerHTML = isAnonymous
        ? '<span class="user-email">Guest</span>'
        : '<span class="user-email">' + (currentUser.email || '') + '</span>';
      linkCreate.style.display = isAnonymous ? 'inline-block' : 'none';
      btnAuth.textContent = 'Sign out';
      btnAuth.style.display = 'inline-block';
      btnAdd.style.display = 'inline-block';
      if (isAnonymous && currentUser.email_confirmed_at) {
        openLinkAccountModal('password');
      }
    } else {
      status.innerHTML = '';
      linkCreate.style.display = 'none';
      btnAuth.textContent = 'Sign in';
      btnAuth.style.display = 'inline-block';
      btnAdd.style.display = 'none';
    }
  }

  function openLinkAccountModal(step) {
    const modal = document.getElementById('link-account-modal');
    const stepEmail = document.getElementById('link-account-step-email');
    const stepSent = document.getElementById('link-account-step-sent');
    const stepPassword = document.getElementById('link-account-step-password');
    stepEmail.style.display = 'none';
    stepSent.style.display = 'none';
    stepPassword.style.display = 'none';
    document.getElementById('link-account-error').textContent = '';
    document.getElementById('link-password-error').textContent = '';
    if (step === 'password' || (currentUser?.is_anonymous && currentUser?.email_confirmed_at)) {
      stepPassword.style.display = 'block';
    } else {
      stepEmail.style.display = 'block';
    }
    modal.classList.add('open');
  }

  function closeLinkAccountModal() {
    document.getElementById('link-account-modal').classList.remove('open');
  }

  document.getElementById('btn-auth').addEventListener('click', async () => {
    if (currentUser) {
      await supabase.auth.signOut();
    } else {
      pendingClick = null;
      document.getElementById('auth-section').style.display = 'none';
      document.getElementById('auth-error').textContent = '';
      document.getElementById('auth-modal').classList.add('open');
    }
  });

  document.getElementById('btn-guest').addEventListener('click', async () => {
    const errEl = document.getElementById('auth-error');
    errEl.textContent = '';
    const { error } = await supabase.auth.signInAnonymously();
    if (error) {
      errEl.textContent = error.message || 'Guest sign-in failed. Try Sign in / Create account.';
      return;
    }
    document.getElementById('auth-modal').classList.remove('open');
    document.getElementById('auth-section').style.display = 'none';
    if (pendingClick) {
      openSpotModal(null, pendingClick);
      pendingClick = null;
    }
  });

  document.getElementById('btn-show-signin').addEventListener('click', () => {
    document.getElementById('auth-section').style.display = 'block';
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
    document.getElementById('auth-section').style.display = 'none';
    if (pendingClick) {
      openSpotModal(null, pendingClick);
      pendingClick = null;
    }
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

  document.getElementById('link-create-account').addEventListener('click', (e) => {
    e.preventDefault();
    if (!currentUser?.is_anonymous) return;
    openLinkAccountModal(currentUser.email_confirmed_at ? 'password' : 'email');
  });

  document.getElementById('btn-link-send').addEventListener('click', async () => {
    const email = document.getElementById('link-email').value.trim();
    const errEl = document.getElementById('link-account-error');
    errEl.textContent = '';
    if (!email) {
      errEl.textContent = 'Enter your email';
      return;
    }
    const { error } = await supabase.auth.updateUser({ email });
    if (error) {
      errEl.textContent = error.message;
      return;
    }
    document.getElementById('link-account-step-email').style.display = 'none';
    document.getElementById('link-account-step-sent').style.display = 'block';
  });

  document.getElementById('btn-link-cancel').addEventListener('click', closeLinkAccountModal);
  document.getElementById('btn-link-close-sent').addEventListener('click', closeLinkAccountModal);

  document.getElementById('btn-link-set-password').addEventListener('click', async () => {
    const password = document.getElementById('link-password').value;
    const errEl = document.getElementById('link-password-error');
    errEl.textContent = '';
    if (!password || password.length < 6) {
      errEl.textContent = 'Password must be at least 6 characters';
      return;
    }
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      errEl.textContent = error.message;
      return;
    }
    closeLinkAccountModal();
    updateAuthUI();
  });

  document.getElementById('btn-link-cancel-pw').addEventListener('click', closeLinkAccountModal);

  document.getElementById('link-account-modal').addEventListener('click', (e) => {
    if (e.target.id === 'link-account-modal') closeLinkAccountModal();
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
          map.panTo({ lat: spot.lat, lng: spot.lng });
          map.setZoom(12);
          const m = markers.find(x => x.spot?.id === spot.id);
          if (m?.infoWindow) {
            sharedInfoWindow.close();
            sharedInfoWindow.setContent(buildSpotPopupContent(spot));
            sharedInfoWindow.open(map, m.marker);
          }
        }
      });
    });
  }

  function buildSpotPopupContent(spot) {
    const xUrl = spot.x_profile ? normalizeXUrl(spot.x_profile) : '';
    const xLink = xUrl ? `<a href="${escapeHtml(xUrl)}" target="_blank" rel="noopener noreferrer" class="popup-x"><svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>View on X</a>` : '';
    return `
      <div class="popup-content">
        <div class="popup-header">
          <h3>${escapeHtml(spot.name)}</h3>
          <button type="button" class="popup-close" aria-label="Close">&times;</button>
        </div>
        <div class="popup-meta">
          <span>${CATEGORIES[spot.category]?.icon || '📍'} ${CATEGORIES[spot.category]?.label || spot.category}</span>
          <span>📍 ${escapeHtml(spot.city)}</span>
          ${spot.event_date ? '<span style="color:var(--accent)">📅 ' + escapeHtml(new Date(spot.event_date + 'T12:00:00').toLocaleDateString()) + '</span>' : ''}
        </div>
        ${spot.description ? '<p class="popup-desc">' + escapeHtml(spot.description) + '</p>' : ''}
        ${spot.image_url ? '<img src="' + escapeHtml(spot.image_url) + '" alt="' + escapeHtml(spot.name) + '" class="popup-img" loading="lazy">' : ''}
        ${xLink}
        ${currentUser && spot.created_by === currentUser.id ? `
          <div class="popup-actions">
            <button class="btn-edit" data-id="${spot.id}">Edit</button>
            <button class="btn-delete" data-id="${spot.id}">Delete</button>
          </div>
        ` : ''}
      </div>
    `;
  }

  function renderMarkers() {
    markers.forEach(m => {
      if (m.marker) m.marker.setMap(null);
    });
    markers = [];
    if (sharedInfoWindow) sharedInfoWindow.close();
    sharedInfoWindow = null;
    sharedInfoWindow = new google.maps.InfoWindow();
    google.maps.event.addListener(sharedInfoWindow, 'domready', () => {
      const gClose = document.querySelector('.gm-style-iw + button, button[aria-label="Close"]');
      if (gClose) gClose.style.display = 'none';
    });
    const filtered = currentFilter === 'all' ? spots : spots.filter(s => s.category === currentFilter);
    filtered.forEach(spot => {
      const marker = new google.maps.Marker({
        position: { lat: spot.lat, lng: spot.lng },
        map,
        label: { text: CATEGORIES[spot.category]?.icon || '📍', color: '#333', fontSize: '16px' },
        icon: { path: google.maps.SymbolPath.CIRCLE, scale: 14, fillColor: '#FF5A2D', fillOpacity: 0.95, strokeColor: '#D14A22', strokeWeight: 2 }
      });
      marker.addListener('click', () => {
        sharedInfoWindow.close();
        sharedInfoWindow.setContent(buildSpotPopupContent(spot));
        sharedInfoWindow.open(map, marker);
      });
      markers.push({ spot, marker, infoWindow: sharedInfoWindow });
    });
  }

  function escapeHtml(s) {
    if (!s) return '';
    const div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
  }

  function normalizeXUrl(val) {
    if (!val || typeof val !== 'string') return '';
    const t = val.trim().replace(/^@/, '');
    if (!t) return '';
    if (/^https?:\/\//i.test(t)) return t;
    return 'https://x.com/' + t.replace(/^x\.com\/?/i, '');
  }

  function reverseGeocode(lat, lng) {
    return new Promise((resolve) => {
      if (!window.google?.maps?.Geocoder) {
        resolve('');
        return;
      }
      const geocoder = new google.maps.Geocoder();
      geocoder.geocode({ location: { lat, lng } }, (results, status) => {
        if (status !== 'OK' || !results?.length) {
          resolve('');
          return;
        }
        const addr = results[0].address_components || [];
        const types = ['locality', 'sublocality', 'administrative_area_level_2', 'administrative_area_level_1', 'country'];
        for (const t of types) {
          const c = addr.find(x => x.types.includes(t));
          if (c) {
            resolve(c.long_name.trim());
            return;
          }
        }
        const formatted = results[0].formatted_address;
        resolve(formatted ? formatted.split(',')[0].trim() : '');
      });
    });
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

  // Add spot button
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
    document.getElementById('spot-image').value = '';
    document.getElementById('spot-image').dataset.existingUrl = spot?.image_url || '';
    document.getElementById('spot-image').dataset.removeImage = '';
    const preview = document.getElementById('spot-image-preview');
    preview.innerHTML = spot?.image_url ? `<img src="${escapeHtml(spot.image_url)}" alt="" style="max-width:100%;border-radius:6px;border:1px solid rgba(255,90,45,0.2)">` : '';
    document.getElementById('spot-event-date').value = spot?.event_date || '';
    document.getElementById('spot-x-profile').value = spot?.x_profile || '';
    document.getElementById('spot-lat').value = fromClick?.lat ?? spot?.lat ?? '';
    document.getElementById('spot-lng').value = fromClick?.lng ?? spot?.lng ?? '';
    const eventDateGroup = document.getElementById('event-date-group');
    eventDateGroup.style.display = (spot?.category || fromClick?.category || 'lobster') === 'meetup' ? 'block' : 'none';
    const removeBtn = document.getElementById('spot-image-remove');
    removeBtn.style.display = spot?.image_url ? 'inline-block' : 'none';
    modal.classList.add('open');
  }

  document.getElementById('spot-category').addEventListener('change', () => {
    document.getElementById('event-date-group').style.display =
      document.getElementById('spot-category').value === 'meetup' ? 'block' : 'none';
  });

  document.getElementById('spot-image').addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    const preview = document.getElementById('spot-image-preview');
    const removeBtn = document.getElementById('spot-image-remove');
    e.target.dataset.removeImage = '';
    if (file) {
      const url = URL.createObjectURL(file);
      preview.innerHTML = `<img src="${url}" alt="" style="max-width:100%;border-radius:6px;border:1px solid rgba(255,90,45,0.2)">`;
      removeBtn.style.display = 'none';
    } else {
      const existing = e.target.dataset.existingUrl;
      preview.innerHTML = existing ? `<img src="${existing}" alt="" style="max-width:100%;border-radius:6px;border:1px solid rgba(255,90,45,0.2)">` : '';
      removeBtn.style.display = existing ? 'inline-block' : 'none';
    }
  });

  document.getElementById('spot-image-remove').addEventListener('click', () => {
    document.getElementById('spot-image').value = '';
    document.getElementById('spot-image').dataset.existingUrl = '';
    document.getElementById('spot-image').dataset.removeImage = '1';
    document.getElementById('spot-image-preview').innerHTML = '';
    document.getElementById('spot-image-remove').style.display = 'none';
  });

  document.getElementById('btn-cancel').addEventListener('click', () => {
    document.getElementById('spot-modal').classList.remove('open');
  });

  document.getElementById('spot-modal').addEventListener('click', (e) => {
    if (e.target.id === 'spot-modal') e.target.classList.remove('open');
  });

  document.getElementById('spot-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentUser) {
      alert('Please sign in to save your spot.');
      document.getElementById('auth-modal').classList.add('open');
      return;
    }
    const id = document.getElementById('spot-id').value;
    const lat = parseFloat(document.getElementById('spot-lat').value);
    const lng = parseFloat(document.getElementById('spot-lng').value);
    if (isNaN(lat) || isNaN(lng)) {
      alert('Please click on the map to choose a location.');
      return;
    }
    const category = document.getElementById('spot-category').value;
    const fileInput = document.getElementById('spot-image');
    let imageUrl = fileInput.dataset.removeImage ? null : (fileInput.dataset.existingUrl || null);
    if (fileInput.files?.[0]) {
      const file = fileInput.files[0];
      const ext = file.name.split('.').pop() || 'jpg';
      const path = `spots/${crypto.randomUUID()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from('spot-images').upload(path, file, { upsert: true });
      if (uploadError) { alert('Image upload failed: ' + uploadError.message); return; }
      const { data } = supabase.storage.from('spot-images').getPublicUrl(path);
      imageUrl = data.publicUrl;
    }
    const xProfileRaw = document.getElementById('spot-x-profile').value.trim();
    const payload = {
      name: document.getElementById('spot-name').value.trim(),
      description: document.getElementById('spot-description').value.trim() || null,
      city: document.getElementById('spot-city').value.trim(),
      category,
      image_url: imageUrl,
      x_profile: xProfileRaw ? normalizeXUrl(xProfileRaw) : null,
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

  document.body.addEventListener('click', (e) => {
    if (e.target.closest('.popup-close')) {
      sharedInfoWindow?.close();
      return;
    }
    const editBtn = e.target.closest('.btn-edit[data-id]');
    if (editBtn) {
      const spot = spots.find(s => s.id === editBtn.dataset.id);
      if (spot) {
        const m = markers.find(x => x.spot?.id === spot.id);
        if (m) m.infoWindow?.close();
        openSpotModal(spot);
      }
      return;
    }
    const delBtn = e.target.closest('.btn-delete[data-id]');
    if (delBtn) {
      const id = delBtn.dataset.id;
      const m = markers.find(x => x.spot?.id === id);
      if (m) m.infoWindow?.close();
      deleteSpot(id);
    }
  });

  async function deleteSpot(id) {
    if (!confirm('Delete this spot?')) return;
    const { error } = await supabase.from('spots').delete().eq('id', id).eq('created_by', currentUser.id);
    if (error) { alert(error.message); return; }
    loadSpots();
  }

  loadGoogleMaps()
    .then(() => {
      initMap();
      return loadSpots();
    })
    .then(() => {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      const activeBtn = document.querySelector(`.filter-btn[data-filter="${currentFilter}"]`);
      if (activeBtn) activeBtn.classList.add('active');
    })
    .catch(err => {
      console.error(err);
      showMapError('Failed to load map: ' + (err.message || 'Unknown error') + '. Check: 1) Billing enabled in Google Cloud, 2) Maps JavaScript API enabled, 3) Key restrictions allow this site (e.g. localhost/*).');
    });
})();
