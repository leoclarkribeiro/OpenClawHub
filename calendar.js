(function() {
  const config = window.OPENCLAW_CONFIG;
  if (!config?.supabaseUrl || !config?.supabaseAnonKey) return;
  const supabase = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey);

  let events = [];
  let currentView = new Date();

  async function loadEvents() {
    const { data, error } = await supabase.from('spots').select('*').eq('category', 'meetup').order('event_date', { ascending: true, nullsFirst: false });
    if (error) { console.error(error); return; }
    events = data || [];
    render();
  }

  function escapeHtml(s) {
    if (!s) return '';
    const d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }

  function formatDate(d) {
    if (!d) return null;
    const date = new Date(d + 'T12:00:00');
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  }

  function render() {
    const year = currentView.getFullYear();
    const month = currentView.getMonth();
    const label = currentView.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    document.getElementById('month-label').textContent = label;

    const filtered = events.filter(e => {
      if (!e.event_date) return true;
      const ed = new Date(e.event_date + 'T12:00:00');
      return ed.getFullYear() === year && ed.getMonth() === month;
    });

    const withDate = filtered.filter(e => e.event_date).sort((a, b) => (a.event_date || '').localeCompare(b.event_date || ''));
    const noDate = filtered.filter(e => !e.event_date);

    const list = document.getElementById('events-list');
    list.innerHTML = (withDate.length + noDate.length) === 0
      ? '<p style="color:var(--muted);font-size:0.9rem">No meetup events this month. <a href="index.html">Add one on the map</a>!</p>'
      : [
          ...withDate.map(e => `
            <div class="event-card">
              <div class="date">${formatDate(e.event_date)}</div>
              <h3>${escapeHtml(e.name)}</h3>
              ${e.description ? `<p>${escapeHtml(e.description)}</p>` : ''}
              <div class="city">📍 ${escapeHtml(e.city)}</div>
              <a href="index.html?filter=meetup" style="display:inline-block;margin-top:0.5rem">View on map →</a>
            </div>
          `),
          ...noDate.map(e => `
            <div class="event-card no-date">
              <div class="date">No date set</div>
              <h3>${escapeHtml(e.name)}</h3>
              ${e.description ? `<p>${escapeHtml(e.description)}</p>` : ''}
              <div class="city">📍 ${escapeHtml(e.city)}</div>
              <a href="index.html?filter=meetup" style="display:inline-block;margin-top:0.5rem">View on map →</a>
            </div>
          `)
        ].join('');
  }

  document.getElementById('btn-prev').addEventListener('click', () => {
    currentView.setMonth(currentView.getMonth() - 1);
    render();
  });

  document.getElementById('btn-next').addEventListener('click', () => {
    currentView.setMonth(currentView.getMonth() + 1);
    render();
  });

  loadEvents();
})();
