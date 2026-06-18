function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function validateSiteData(siteData) {
  if (!siteData || typeof siteData !== 'object') {
    throw new Error('Invalid site data: expected an object payload.');
  }
  if (!Array.isArray(siteData.commands)) {
    throw new Error('Invalid site data: commands must be an array.');
  }
  if (!Array.isArray(siteData.items)) {
    throw new Error('Invalid site data: items must be an array.');
  }
  return siteData;
}

function renderStats(stats) {
  const entries = Object.entries(stats ?? {});
  if (!entries.length) return '<span class="meta">No direct stat changes</span>';
  return entries
    .map(([key, value]) => `<span class="pill">${escapeHtml(key)}: ${escapeHtml(value)}</span>`)
    .join('');
}

function renderAbility(ability) {
  if (!ability) return '<span class="meta">No ability</span>';
  const params = Object.entries(ability)
    .filter(([key]) => key !== 'id' && key !== 'name')
    .map(([key, value]) => `${key}: ${value}`)
    .join(', ');
  return `<strong>${escapeHtml(ability.id)}</strong>${params ? ` <span class="meta">${escapeHtml(params)}</span>` : ''}`;
}

function groupCommands(commands) {
  return commands.reduce((groups, command) => {
    const section = command.section ?? 'Other';
    groups[section] ??= [];
    groups[section].push(command);
    return groups;
  }, {});
}

function renderStatus(document, message, className = '') {
  const status = document.getElementById('status-panel');
  status.textContent = message;
  status.className = className ? `status-panel ${className}` : 'status-panel';
}

function renderFallback(document, message) {
  const content = `
    <article class="card fallback-card">
      <p class="section-label">Recovery steps</p>
      <h3>Unable to load the codex</h3>
      <p>${escapeHtml(message)}</p>
      <p class="meta">Try rebuilding the static site bundle and refreshing the page. If this happens on GitHub Pages, check that <code>data/site-data.json</code> exists in the published artifact.</p>
    </article>
  `;
  document.getElementById('commands-grid').innerHTML = content;
  document.getElementById('items-grid').innerHTML = content;
  document.getElementById('items-meta').textContent = 'No item data could be rendered.';
  document.getElementById('item-summary').innerHTML = '';
  renderStatus(document, 'Unable to load the codex.', 'error');
}

function renderCommands(document, commands) {
  const groups = groupCommands(commands);
  const root = document.getElementById('commands-grid');
  root.innerHTML = Object.entries(groups).map(([section, sectionCommands]) => `
    <section class="card command-group">
      <p class="section-label">${escapeHtml(section)}</p>
      <div class="command-grid">
        ${sectionCommands.map(command => `
          <article class="card command-card">
            <h3>/${escapeHtml(command.name)}</h3>
            <p>${escapeHtml(command.description)}</p>
            <p><code>${escapeHtml(command.usage)}</code></p>
            <p class="meta">${escapeHtml(command.details)}</p>
          </article>
        `).join('')}
      </div>
    </section>
  `).join('');
}

function buildItemSummary(items) {
  const byRarity = items.reduce((summary, item) => {
    summary[item.rarity] = (summary[item.rarity] ?? 0) + 1;
    return summary;
  }, {});

  return Object.entries(byRarity).map(([rarity, count]) => `
    <div class="summary-chip">
      <span class="meta">${escapeHtml(rarity)}</span>
      <strong>${count}</strong>
    </div>
  `).join('');
}

function renderItems(document, items) {
  document.getElementById('items-meta').textContent = `Generated from live game definitions. Total items: ${items.length}`;
  document.getElementById('item-summary').innerHTML = buildItemSummary(items);
  const root = document.getElementById('items-grid');
  root.innerHTML = items.map(item => `
    <article class="card item-card">
      <div class="card-header">
        <h3>${escapeHtml(item.name)}</h3>
        <span class="badge">${escapeHtml(item.rarity)}</span>
      </div>
      <p class="meta"><code>${escapeHtml(item.id)}</code> · ${escapeHtml(item.slot)} · ${escapeHtml(item.price)} spores</p>
      <p>${escapeHtml(item.description ?? 'No description')}</p>
      <div class="pill-row">${renderStats(item.stats)}</div>
      <p class="meta">Ability: ${renderAbility(item.ability)}</p>
    </article>
  `).join('');
}

export async function bootSite({ document, fetchImpl }) {
  renderStatus(document, 'Loading codex data...');
  try {
    const response = await fetchImpl('./data/site-data.json');
    if (!response.ok) {
      throw new Error(`Failed to load site data: ${response.status}`);
    }

    const siteData = validateSiteData(await response.json());
    renderCommands(document, siteData.commands);
    renderItems(document, siteData.items);
    renderStatus(
      document,
      `Loaded ${siteData.commands.length} commands and ${siteData.items.length} items.`
    );
  } catch (error) {
    renderFallback(document, error instanceof Error ? error.message : String(error));
  }
}

if (typeof document !== 'undefined' && typeof fetch !== 'undefined') {
  bootSite({ document, fetchImpl: fetch });
}
