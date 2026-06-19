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

// ─── Constants ──────────────────────────────────────────────────────────────

const STAT_EMOJIS = { attack: '⚔️', hp: '💚', armor: '🛡️', hpCost: '🩸' };
const STAT_SIGNS  = { attack: true, hp: true, armor: true };
const BASE_STATS  = { hp: 100, attack: 10, armor: 0 };

const ARCHETYPES = [
  {
    name: 'Glass Cannon',
    tagline: 'Maximum damage, minimum survival plan',
    strategy: 'Stack attack items and accept the HP cost. Win fast or don\'t win at all. Works best in Fevered or Smoldering Depths wellsprings where the field boosts your already-inflated attack.',
    items: ['twin_knives', 'barbarian_suit'],
    tip: 'Twin Knives + Double Strike into a Fevered wellspring can KO opponents in two turns before they react.',
  },
  {
    name: 'Ironclad',
    tagline: 'Defense that wears the enemy down',
    strategy: 'Stack armor and barrier to reduce incoming damage to near zero. Let Thorn or Vampirism close out fights you\'ve already won defensively. The longer the fight, the more your kit matters.',
    items: ['warden_shield', 'fortify_plate', 'discharge_carapace'],
    tip: 'Still Waters wellsprings grant +4 armor on top of your kit — guardians there are built to pierce armor, so bring Void.',
  },
  {
    name: 'Blood Ritual',
    tagline: 'Pay HP to deal HP — and win the race',
    strategy: 'Use HP-cost items to accelerate the fight\'s tempo, then out-sustain with Vampirism or Regeneration. Blood Pact applies symmetric drain, so only equip it if you can outlast the opponent in the burn.',
    items: ['blood_pact_ring', 'bloom_salve'],
    tip: 'Blood Pact is symmetric — if your opponent also has sustain, you\'re feeding them. Scout the arena first.',
  },
  {
    name: 'Venom & Wither',
    tagline: 'Debuff stacking for slow, inevitable victory',
    strategy: 'Apply stacking debuffs — Venom, Weaken, Wither — to erode the opponent\'s effective stats every turn. Your gear doesn\'t need raw power if theirs stops working. Pure attrition.',
    items: ['venom_fang', 'weaken_whip', 'wasting_blade'],
    tip: 'Use Arena practice mode to calibrate debuff timing against high-armor builds before taking contested wellsprings.',
  },
  {
    name: 'Heroic Ascent',
    tagline: 'Start weak, finish unstoppable',
    strategy: 'Ancient Sword\'s Heroic ability gains attack equal to damage dealt each turn. In a long fight you become exponentially stronger. Pair with survival items to reach the later turns where Heroic compounds.',
    items: ['ancient_sword', 'bloom_salve'],
    tip: 'Avoid Ambush opponents early — they spike damage before your Heroic ramp reaches critical mass.',
  },
];

// ─── Tabs ────────────────────────────────────────────────────────────────────

function initTabs(document) {
  if (typeof document.querySelectorAll !== 'function') return;
  document.querySelectorAll('[role="tab"]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[role="tab"]').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('tab-' + btn.dataset.tab)?.classList.add('active');
    });
  });
}

// ─── Status ──────────────────────────────────────────────────────────────────

function renderStatus(document, message, className = '') {
  const status = document.getElementById('status-panel');
  if (!status) return;
  status.textContent = message;
  status.className = className ? `status-panel ${className}` : 'status-panel';
}

// ─── Fallback ─────────────────────────────────────────────────────────────────

function renderFallback(document, message) {
  const content = `
    <article class="card fallback-card">
      <p class="section-label">Recovery steps</p>
      <h3>Unable to load the codex</h3>
      <p>${escapeHtml(message)}</p>
      <p class="meta">Try rebuilding the static site bundle and refreshing the page.</p>
    </article>
  `;
  const targets = ['commands-grid', 'items-grid', 'archetypes-grid', 'wellsprings-grid'];
  targets.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = content;
  });
  const meta = document.getElementById('item-summary');
  if (meta) meta.innerHTML = '';
  renderStatus(document, 'Unable to load the codex.', 'error');
}

// ─── Stat helpers ─────────────────────────────────────────────────────────────

function statSign(key, value) {
  return STAT_SIGNS[key] && value > 0 ? `+${value}` : `${value}`;
}

function renderStatChips(stats) {
  const entries = Object.entries(stats ?? {});
  if (!entries.length) return '<span class="meta">No stat changes</span>';
  return entries
    .map(([key, value]) =>
      `<span class="pill stat-chip">${STAT_EMOJIS[key] ?? '✨'} <span>${escapeHtml(statSign(key, value))} ${escapeHtml(key)}</span></span>`)
    .join('');
}

// ─── Loadout tester ───────────────────────────────────────────────────────────

function initLoadoutTester(document, items) {
  const slots = ['weapon', 'armor', 'accessory'];
  const firstSelect = document.getElementById('slot-weapon');
  if (!firstSelect || typeof firstSelect.appendChild !== 'function') return;

  slots.forEach(slot => {
    const select = document.getElementById(`slot-${slot}`);
    if (!select) return;
    const slotItems = items.filter(i => i.slot === slot);
    slotItems.forEach(item => {
      const opt = document.createElement('option');
      opt.value = item.id;
      opt.textContent = `${item.name} (${item.rarity})`;
      select.appendChild(opt);
    });
    select.addEventListener('change', () => updateLoadout(document, items));
  });

  const clearBtn = document.getElementById('loadout-clear');
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      slots.forEach(slot => {
        const select = document.getElementById(`slot-${slot}`);
        if (select) select.value = '';
      });
      updateLoadout(document, items);
    });
  }

  updateLoadout(document, items);
}

function updateLoadout(document, items) {
  const slots = ['weapon', 'armor', 'accessory'];
  const equipped = slots
    .map(slot => {
      const select = document.getElementById(`slot-${slot}`);
      if (!select?.value) return null;
      return items.find(i => i.id === select.value) ?? null;
    })
    .filter(Boolean);

  const totals = { ...BASE_STATS };
  for (const item of equipped) {
    for (const [key, val] of Object.entries(item.stats ?? {})) {
      if (key === 'hpCost') {
        totals.hp = (totals.hp ?? 0) - val;
      } else {
        totals[key] = (totals[key] ?? 0) + val;
      }
    }
  }

  const statsEl = document.getElementById('loadout-stats');
  if (statsEl) {
    statsEl.innerHTML = `
      <div class="stat-display stat-hp">
        <span>💚</span>
        <span class="stat-val">${totals.hp}</span>
        <span class="stat-label">HP</span>
      </div>
      <div class="stat-display stat-attack">
        <span>⚔️</span>
        <span class="stat-val">${totals.attack}</span>
        <span class="stat-label">Attack</span>
      </div>
      <div class="stat-display stat-armor">
        <span>🛡️</span>
        <span class="stat-val">${totals.armor}</span>
        <span class="stat-label">Armor</span>
      </div>
    `;
  }

  const abilitiesEl = document.getElementById('loadout-abilities');
  if (abilitiesEl) {
    const abilities = equipped.filter(i => i.ability).map(i => i.ability);
    abilitiesEl.innerHTML = abilities.length
      ? abilities.map(a => `
          <span class="ability-pill" title="${escapeHtml(a.description ?? '')}">
            ✨ <strong>${escapeHtml(a.name ?? a.id)}</strong>
          </span>
        `).join('')
      : '<span class="meta">No abilities equipped</span>';
  }
}

// ─── Filter bar ───────────────────────────────────────────────────────────────

function initFilterBar(document, items, onFilter) {
  const bar = document.getElementById('filter-bar');
  if (!bar || typeof bar.appendChild !== 'function') return;

  const slots    = [...new Set(items.map(i => i.slot))].sort();
  const rarities = ['common', 'uncommon', 'rare', 'epic'].filter(r => items.some(i => i.rarity === r));

  const active = { slot: null, rarity: null };

  function makeChip(label, value, group, extraAttr = '') {
    const btn = document.createElement('button');
    btn.className = 'filter-chip';
    btn.textContent = label;
    if (extraAttr) btn.setAttribute(`data-${group}`, value);
    btn.addEventListener('click', () => {
      if (active[group] === value) {
        active[group] = null;
        btn.classList.remove('active');
      } else {
        bar.querySelectorAll(`[data-filter-group="${group}"]`).forEach(b => b.classList.remove('active'));
        active[group] = value;
        btn.classList.add('active');
      }
      onFilter(active);
    });
    btn.dataset.filterGroup = group;
    return btn;
  }

  const slotGroup = document.createElement('div');
  slotGroup.className = 'filter-group';
  slots.forEach(slot => {
    const icons = { weapon: '⚔️', armor: '🛡️', accessory: '💍' };
    slotGroup.appendChild(makeChip(`${icons[slot] ?? ''} ${slot}`, slot, 'slot', slot));
  });

  const divider = document.createElement('div');
  divider.className = 'filter-divider';

  const rarityGroup = document.createElement('div');
  rarityGroup.className = 'filter-group';
  rarities.forEach(rarity => {
    const chip = makeChip(rarity, rarity, 'rarity', rarity);
    chip.setAttribute('data-rarity', rarity);
    rarityGroup.appendChild(chip);
  });

  bar.appendChild(slotGroup);
  bar.appendChild(divider);
  bar.appendChild(rarityGroup);
}

// ─── Items ────────────────────────────────────────────────────────────────────

function renderItemGrid(document, items) {
  const firstByRarity = new Set();
  const root = document.getElementById('items-grid');
  if (!root) return;

  root.innerHTML = items.length
    ? items.map(item => {
        const anchorAttr = (() => {
          if (firstByRarity.has(item.rarity)) return '';
          firstByRarity.add(item.rarity);
          return ` id="item-rarity-${escapeHtml(item.rarity)}"`;
        })();
        const ability = item.ability;
        return `
          <article class="card item-card" data-rarity="${escapeHtml(item.rarity)}" data-slot="${escapeHtml(item.slot)}"${anchorAttr}>
            <div class="card-header">
              <h3>${escapeHtml(item.name)}</h3>
              <span class="badge" data-rarity="${escapeHtml(item.rarity)}">${escapeHtml(item.rarity)}</span>
            </div>
            <p class="meta">${escapeHtml(item.description ?? 'No description')}</p>
            <div class="pill-row">${renderStatChips(item.stats)}</div>
            ${ability ? `<p class="item-ability">✨ <strong>${escapeHtml(ability.name ?? ability.id)}</strong>: ${escapeHtml(ability.description ?? '')}</p>` : ''}
            ${item.flavor ? `<p class="item-flavor">${escapeHtml(item.flavor)}</p>` : ''}
            <footer class="item-card-footer">
              <code>${escapeHtml(item.id)}</code>
              <span>${escapeHtml(String(item.price))} spores</span>
            </footer>
          </article>
        `;
      }).join('')
    : '<p class="meta" style="grid-column:1/-1;padding:20px 0">No items match the current filters.</p>';
}

function buildItemSummary(items) {
  const byRarity = items.reduce((acc, item) => {
    acc[item.rarity] ??= 0;
    acc[item.rarity]++;
    return acc;
  }, {});

  return Object.entries(byRarity)
    .map(([rarity, count]) => `
      <a class="summary-chip" href="#item-rarity-${escapeHtml(rarity)}">
        <strong>${count}</strong>
        <span class="meta">${escapeHtml(rarity)}</span>
      </a>
    `)
    .join('');
}

function renderItems(document, items) {
  const summaryEl = document.getElementById('item-summary');
  if (summaryEl) summaryEl.innerHTML = buildItemSummary(items);

  let allItems = items;

  initFilterBar(document, items, (active) => {
    allItems = items.filter(item => {
      if (active.slot   && item.slot   !== active.slot)   return false;
      if (active.rarity && item.rarity !== active.rarity) return false;
      return true;
    });
    renderItemGrid(document, allItems);
  });

  renderItemGrid(document, items);
  initLoadoutTester(document, items);
}

// ─── Archetypes ───────────────────────────────────────────────────────────────

function renderArchetypes(document, items) {
  const itemMap = Object.fromEntries(items.map(i => [i.id, i]));
  const root = document.getElementById('archetypes-grid');
  if (!root) return;

  root.innerHTML = ARCHETYPES.map(arch => {
    const resolvedItems = arch.items
      .map(id => itemMap[id])
      .filter(Boolean);

    const itemPills = resolvedItems.map(item =>
      `<span class="archetype-item-pill" data-rarity="${escapeHtml(item.rarity)}">
        ${escapeHtml(item.slot === 'weapon' ? '⚔️' : item.slot === 'armor' ? '🛡️' : '💍')}
        ${escapeHtml(item.name)}
      </span>`
    ).join('');

    return `
      <article class="archetype-card">
        <div>
          <h3 class="archetype-name">${escapeHtml(arch.name)}</h3>
          <p class="archetype-tagline">${escapeHtml(arch.tagline)}</p>
        </div>
        <p class="archetype-strategy">${escapeHtml(arch.strategy)}</p>
        ${itemPills ? `<div class="archetype-items">${itemPills}</div>` : ''}
        <div class="archetype-tip">${escapeHtml(arch.tip)}</div>
      </article>
    `;
  }).join('');
}

// ─── Commands ─────────────────────────────────────────────────────────────────

function groupCommands(commands) {
  return commands.reduce((groups, command) => {
    if (!command.parent && (command.name === 'game' || command.name === 'arena')) {
      return groups;
    }
    const section = command.section ?? 'Other';
    groups[section] ??= [];
    groups[section].push(command);
    return groups;
  }, {});
}

function renderCommands(document, commands) {
  const groups = groupCommands(commands);
  const root = document.getElementById('commands-grid');
  if (!root) return;

  root.innerHTML = Object.entries(groups).map(([section, sectionCommands]) => `
    <section class="command-group">
      <p class="section-label">${escapeHtml(section)}</p>
      <div class="command-grid">
        ${sectionCommands.map(command => `
          <article class="command-card">
            ${command.parent ? `<div class="command-parent">↳ /${escapeHtml(command.parent)}</div>` : ''}
            <h3>/${escapeHtml(command.name)}</h3>
            <div class="command-signature"><code>${escapeHtml(command.usage)}</code></div>
            <p class="command-desc">${escapeHtml(command.description)}</p>
            <p class="command-details">${escapeHtml(command.details)}</p>
          </article>
        `).join('')}
      </div>
    </section>
  `).join('');
}

// ─── Wellsprings ──────────────────────────────────────────────────────────────

function renderModChip(key, value) {
  const emoji = STAT_EMOJIS[key] ?? '✨';
  const sign  = value > 0 ? '+' : '';
  const cls   = value > 0 ? 'positive' : 'negative';
  return `<span class="wellspring-mod ${cls}">${emoji} ${sign}${value} ${escapeHtml(key)}</span>`;
}

function renderWellsprings(document, wellsprings) {
  const root = document.getElementById('wellsprings-grid');
  if (!root) return;

  if (!wellsprings?.length) {
    root.innerHTML = '<p class="meta">No wellspring data available.</p>';
    return;
  }

  const RARITY_ORDER = ['common', 'uncommon', 'rare'];
  const byRarity = {};
  wellsprings.forEach(w => {
    byRarity[w.rarity] ??= [];
    byRarity[w.rarity].push(w);
  });

  root.innerHTML = RARITY_ORDER.filter(r => byRarity[r]?.length).map(rarity => {
    const group = byRarity[rarity];
    const sporesPerHour = group[0]?.sporesPerHour ?? '?';

    const cards = group.map(ws => {
      const modChips = Object.entries(ws.modifiers ?? {}).map(([k, v]) => renderModChip(k, v)).join('');
      const grantChips = (ws.grantAbilities ?? []).map(a =>
        `<span class="wellspring-mod grant">✨ grants ${escapeHtml(a)}</span>`
      ).join('');

      let guardianHtml = '';
      if (ws.guardian) {
        const g = ws.guardian;
        const statsHtml = [
          `<span class="guardian-stat">💚 ${g.hp} HP</span>`,
          `<span class="guardian-stat">⚔️ ${g.attack} ATK</span>`,
          g.armor ? `<span class="guardian-stat">🛡️ ${g.armor} Armor</span>` : '',
        ].filter(Boolean).join('');
        const abilitiesHtml = (g.abilities ?? []).map(a =>
          `<span class="guardian-ability">${escapeHtml(a)}</span>`
        ).join('');
        const hintHtml = ws.guardianHint
          ? `<p class="guardian-hint">${escapeHtml(ws.guardianHint)}</p>`
          : '';
        guardianHtml = `
          <div class="guardian-section">
            <div class="guardian-label">Guardian</div>
            <div class="guardian-stats">${statsHtml}</div>
            ${abilitiesHtml ? `<div class="guardian-abilities">${abilitiesHtml}</div>` : ''}
            ${hintHtml}
          </div>
        `;
      }

      return `
        <article class="wellspring-card ${escapeHtml(rarity)}">
          <h3>${escapeHtml(ws.label)}</h3>
          <p class="wellspring-desc">${escapeHtml(ws.description ?? '')}</p>
          ${modChips || grantChips ? `<div class="wellspring-mods">${modChips}${grantChips}</div>` : ''}
          <div class="wellspring-income">Passive income: <span>${escapeHtml(String(ws.sporesPerHour))} spores/hr</span></div>
          ${guardianHtml}
        </article>
      `;
    }).join('');

    return `
      <div class="wellspring-rarity-group">
        <div class="wellspring-rarity-heading">
          <h3>${rarity}</h3>
          <span class="wellspring-rarity-badge ${escapeHtml(rarity)}">${escapeHtml(rarity)}</span>
          <span class="meta">${escapeHtml(String(sporesPerHour))} spores/hr · ${group.length} type${group.length !== 1 ? 's' : ''}</span>
        </div>
        <div class="wellspring-grid">${cards}</div>
      </div>
    `;
  }).join('');
}

// ─── Boot ─────────────────────────────────────────────────────────────────────

export async function bootSite({ document, fetchImpl }) {
  initTabs(document);
  renderStatus(document, 'Loading codex data…');

  try {
    const response = await fetchImpl('./data/site-data.json');
    if (!response.ok) throw new Error(`Failed to load site data: ${response.status}`);

    const siteData = validateSiteData(await response.json());

    renderCommands(document, siteData.commands);
    renderItems(document, siteData.items);
    renderArchetypes(document, siteData.items);
    renderWellsprings(document, siteData.wellsprings ?? []);

    renderStatus(
      document,
      `Loaded ${siteData.commands.length} commands and ${siteData.items.length} items · ${(siteData.wellsprings ?? []).length} wellspring types`
    );
  } catch (error) {
    renderFallback(document, error instanceof Error ? error.message : String(error));
  }
}

if (typeof document !== 'undefined' && typeof fetch !== 'undefined') {
  bootSite({ document, fetchImpl: fetch });
}
