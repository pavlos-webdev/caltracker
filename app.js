/* ─────────────────────────────────────────
   CalTrack — app.js
   USDA FoodData Central API
   Replace USDA_API_KEY with your key from:
   https://fdc.nal.usda.gov/api-guide.html
───────────────────────────────────────── */

const USDA_API_KEY = 'DEMO_KEY'; // Replace with your free key
const USDA_BASE    = 'https://api.nal.usda.gov/fdc/v1';

// ── State ──────────────────────────────────
const MEAL_NAMES = ['Breakfast', 'Lunch', 'Dinner', 'Snacks'];
const FOOD_ICONS = { Breakfast: '🌅', Lunch: '🥗', Dinner: '🍽️', Snacks: '🍎' };
const DAYS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];

let state = loadState();

function defaultState() {
  return {
    goal: 2000,
    weekOffset: 0,          // 0 = current week, -1 = last week, etc.
    week: {},                // keyed by "YYYY-MM-DD" - will be populated as needed
    activeDateKey: todayKey(),
    activeMeal: 'Breakfast',
  };
}

function loadState() {
  try {
    const s = JSON.parse(localStorage.getItem('caltrack_v2'));
    if (s) {
      // Ensure today exists and migrate old state
      const tk = todayKey();
      if (!s.week[tk]) s.week[tk] = emptyDay();
      s.activeDateKey = tk;
      // Add weekOffset if missing (for backward compatibility)
      if (s.weekOffset === undefined) s.weekOffset = 0;
      return s;
    }
  } catch (_) {}
  return defaultState();
}

function saveState() {
  try { localStorage.setItem('caltrack_v2', JSON.stringify(state)); } catch(_) {}
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function buildWeek(offset = 0) {
  const week = {};
  const today = new Date();
  // Calculate Monday of the target week
  const dow = (today.getDay() + 6) % 7; // Convert Sun=0 to Mon=0
  const monday = new Date(today);
  monday.setDate(today.getDate() - dow + (offset * 7));
  
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    week[d.toISOString().slice(0, 10)] = emptyDay();
  }
  return week;
}

function emptyDay() {
  const day = {};
  MEAL_NAMES.forEach(m => day[m] = []);
  return day;
}

function currentDayData() {
  return state.week[state.activeDateKey] || emptyDay();
}

// ── DOM refs ───────────────────────────────
const ringFill      = document.getElementById('ring-fill');
const ringCal       = document.getElementById('ring-cal');
const sumGoal       = document.getElementById('sum-goal');
const sumEaten      = document.getElementById('sum-eaten');
const weekRange     = document.getElementById('week-range');
const prevWeekBtn   = document.getElementById('prev-week');
const nextWeekBtn   = document.getElementById('next-week');
const sumLeft       = document.getElementById('sum-left');
const mealsContainer= document.getElementById('meals-container');
const dayTrack      = document.getElementById('day-track');

// Overlays
const addOverlay     = document.getElementById('add-overlay');
const goalOverlay    = document.getElementById('goal-overlay');
const servingOverlay = document.getElementById('serving-overlay');

// Add-food sheet
const foodSearch    = document.getElementById('food-search');
const resultsList   = document.getElementById('results-list');
const searchSpinner = document.getElementById('search-spinner');
const mealTabs      = document.getElementById('meal-tabs');
const manualWrap    = document.getElementById('manual-wrap');
const toggleManual  = document.getElementById('toggle-manual');
const manualName    = document.getElementById('manual-name');
const manualCalEl   = document.getElementById('manual-cal');
const manualServing = document.getElementById('manual-serving');
const manualAddBtn  = document.getElementById('manual-add');

// Goal sheet
const goalInput     = document.getElementById('goal-input');
const goalSave      = document.getElementById('goal-save');

// Serving sheet
const servingFoodName = document.getElementById('serving-food-name');
const servingOptions  = document.getElementById('serving-options');
const servingCustomG  = document.getElementById('serving-custom-g');
const servingCustomAdd= document.getElementById('serving-custom-add');

// ── Render ─────────────────────────────────
function render() {
  // Ensure current week data exists
  const weekStart = getWeekStartDate(state.weekOffset);
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    const key = d.toISOString().slice(0, 10);
    if (!state.week[key]) {
      state.week[key] = emptyDay();
    }
  }
  
  renderWeekRange();
  renderDate();
  renderDayBar();
  renderSummary();
  renderMeals();
  saveState();
}

function renderWeekRange() {
  const weekStart = getWeekStartDate(state.weekOffset);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  
  const startMonth = weekStart.toLocaleDateString('en-US', { month: 'short' });
  const endMonth = weekEnd.toLocaleDateString('en-US', { month: 'short' });
  const startDay = weekStart.getDate();
  const endDay = weekEnd.getDate();
  const year = weekStart.getFullYear();
  
  let rangeText;
  if (weekStart.getMonth() === weekEnd.getMonth()) {
    rangeText = `${startMonth} ${startDay}–${endDay}, ${year}`;
  } else {
    rangeText = `${startMonth} ${startDay} – ${endMonth} ${endDay}, ${year}`;
  }
  
  weekRange.textContent = rangeText;
  
  // Enable/disable navigation buttons
  prevWeekBtn.disabled = false; // Can always go back
  nextWeekBtn.disabled = state.weekOffset >= 0; // Can't go to future weeks
}

function renderDate() {
  const el = document.getElementById('current-date');
  const d  = new Date(state.activeDateKey + 'T12:00:00');
  el.textContent = d.toLocaleDateString('en-US', { weekday:'long', month:'long', day:'numeric' });
}

function renderDayBar() {
  dayTrack.innerHTML = '';
  const weekStart = getWeekStartDate(state.weekOffset);
  const todayKeyStr = todayKey();
  
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    const key = d.toISOString().slice(0, 10);
    
    const dow = DAYS[(d.getDay() + 6) % 7];
    const dayNum = d.getDate();
    const isActive = key === state.activeDateKey;
    const isFuture = key > todayKeyStr;
    const dayData = state.week[key] || emptyDay();
    const hasMeals = MEAL_NAMES.some(m => dayData[m] && dayData[m].length > 0);

    const btn = document.createElement('button');
    btn.className = 'day-chip' + (isActive ? ' active' : '') + (isFuture ? ' disabled' : '');
    btn.setAttribute('aria-pressed', isActive);
    if (isFuture) {
      btn.disabled = true;
      btn.setAttribute('aria-disabled', 'true');
    }
    btn.innerHTML = `
      <span class="day-chip-label">${dow}</span>
      <span class="day-chip-num">${dayNum}</span>
    `;
    if (hasMeals) {
      const dot = document.createElement('span');
      dot.className = 'day-dot';
      btn.appendChild(dot);
    }
    if (!isFuture) {
      btn.addEventListener('click', () => {
        state.activeDateKey = key;
        render();
      });
    }
    dayTrack.appendChild(btn);
  }

  // Scroll active chip into view
  const activeChip = dayTrack.querySelector('.day-chip.active');
  if (activeChip) {
    activeChip.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }
}

function totalCalories(dayData) {
  return MEAL_NAMES.reduce((sum, m) => {
    return sum + (dayData[m] || []).reduce((s, f) => s + f.calories, 0);
  }, 0);
}

function renderSummary() {
  const eaten = totalCalories(currentDayData());
  const left  = state.goal - eaten;
  const pct   = Math.min(eaten / state.goal, 1);
  const circumference = 2 * Math.PI * 27; // r=27 → ~169.6

  sumGoal.textContent  = state.goal;
  sumEaten.textContent = eaten;
  sumLeft.textContent  = Math.max(0, left);
  ringCal.textContent  = eaten;

  sumLeft.classList.toggle('over', left < 0);

  ringFill.style.strokeDashoffset = circumference * (1 - pct);
  ringFill.classList.toggle('over', left < 0);
}

function renderMeals() {
  mealsContainer.innerHTML = '';
  const dayData = currentDayData();
  MEAL_NAMES.forEach(meal => {
    const entries = dayData[meal] || [];
    const total   = entries.reduce((s, f) => s + f.calories, 0);

    const section = document.createElement('section');
    section.className = 'meal-section';
    section.innerHTML = `
      <div class="meal-header">
        <h2 class="meal-name">${FOOD_ICONS[meal]} ${meal}</h2>
        <span class="meal-total"><span>${total}</span> kcal</span>
      </div>
      <div class="meal-card">
        ${entries.length === 0
          ? `<p class="meal-empty">No entries yet — tap + to add food</p>`
          : entries.map((f, i) => foodRowHTML(f, meal, i)).join('')
        }
      </div>
    `;
    mealsContainer.appendChild(section);

    // Attach delete listeners
    section.querySelectorAll('.food-del').forEach(btn => {
      btn.addEventListener('click', () => {
        const meal2 = btn.dataset.meal;
        const idx   = parseInt(btn.dataset.idx, 10);
        currentDayData()[meal2].splice(idx, 1);
        render();
      });
    });
  });
}

function foodRowHTML(food, meal, idx) {
  return `
    <div class="food-row">
      <div class="food-icon">🍴</div>
      <div class="food-info">
        <div class="food-name">${escHtml(food.name)}</div>
        <div class="food-serving">${escHtml(food.serving || '')}</div>
      </div>
      <div class="food-cal">${food.calories} kcal</div>
      <button class="food-del" data-meal="${escHtml(meal)}" data-idx="${idx}" aria-label="Remove ${escHtml(food.name)}">×</button>
    </div>
  `;
}

function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── USDA Search ────────────────────────────
let searchTimeout = null;
let pendingFood   = null; // food awaiting serving selection

foodSearch.addEventListener('input', () => {
  clearTimeout(searchTimeout);
  const q = foodSearch.value.trim();
  if (!q) { resultsList.innerHTML = ''; return; }
  searchTimeout = setTimeout(() => doSearch(q), 420);
});

async function doSearch(query) {
  searchSpinner.hidden = false;
  resultsList.innerHTML = '';
  try {
    const url = `${USDA_BASE}/foods/search?query=${encodeURIComponent(query)}&pageSize=12&api_key=${USDA_API_KEY}`;
    const res  = await fetch(url);
    if (!res.ok) throw new Error('API error ' + res.status);
    const data = await res.json();
    renderResults(data.foods || []);
  } catch (err) {
    resultsList.innerHTML = `<div class="result-empty">⚠️ Search failed. Check your API key or try again.</div>`;
    console.error(err);
  } finally {
    searchSpinner.hidden = true;
  }
}

function renderResults(foods) {
  if (!foods.length) {
    resultsList.innerHTML = `<div class="result-empty">No results found. Try a different term or enter manually.</div>`;
    return;
  }
  resultsList.innerHTML = '';
  foods.forEach(food => {
    const cal100 = getCalPer100(food);
    const item   = document.createElement('div');
    item.className = 'result-item';
    item.innerHTML = `
      <div class="result-info">
        <div class="result-name">${escHtml(food.description)}</div>
        <div class="result-brand">${escHtml(food.brandName || food.foodCategory || '')}</div>
      </div>
      <div class="result-cal">${cal100 != null ? Math.round(cal100) + ' kcal/100g' : '—'}</div>
    `;
    item.addEventListener('click', () => openServingSheet(food));
    resultsList.appendChild(item);
  });
}

function getCalPer100(food) {
  if (!food.foodNutrients) return null;
  const en = food.foodNutrients.find(n =>
    n.nutrientId === 1008 || n.nutrientName === 'Energy' ||
    (n.unitName === 'KCAL' && n.nutrientName && n.nutrientName.toLowerCase().includes('energy'))
  );
  if (en) return en.value;
  // fallback: first KCAL nutrient
  const fb = food.foodNutrients.find(n => n.unitName === 'KCAL');
  return fb ? fb.value : null;
}

// ── Serving Sheet ──────────────────────────
function openServingSheet(food) {
  pendingFood = food;
  servingFoodName.textContent = food.description;
  servingOptions.innerHTML = '';
  servingCustomG.value = '';

  // Try to get serving sizes
  const measures = food.foodMeasures || [];
  const cal100   = getCalPer100(food);

  if (measures.length) {
    measures.slice(0, 6).forEach(m => {
      const grams = m.gramWeight || 100;
      const cal   = cal100 != null ? Math.round(cal100 * grams / 100) : null;
      const opt   = document.createElement('div');
      opt.className = 'serving-option';
      opt.innerHTML = `
        <div>
          <div class="serving-name">${escHtml(m.disseminationText || m.modifier || '1 serving')}</div>
          <div class="serving-amount">${grams}g</div>
        </div>
        <div class="serving-kcal">${cal != null ? cal + ' kcal' : '—'}</div>
      `;
      opt.addEventListener('click', () => {
        if (cal != null) addFoodEntry(food.description, cal, m.disseminationText || m.modifier || `${grams}g`);
        else addFoodEntry(food.description, 0, `${grams}g`);
        closeServingSheet();
        closeAddSheet();
      });
      servingOptions.appendChild(opt);
    });
  } else if (cal100 != null) {
    // Default servings: 100g, 150g, 200g
    [100, 150, 200].forEach(g => {
      const cal = Math.round(cal100 * g / 100);
      const opt = document.createElement('div');
      opt.className = 'serving-option';
      opt.innerHTML = `
        <div><div class="serving-name">${g}g</div><div class="serving-amount">standard</div></div>
        <div class="serving-kcal">${cal} kcal</div>
      `;
      opt.addEventListener('click', () => {
        addFoodEntry(food.description, cal, `${g}g`);
        closeServingSheet();
        closeAddSheet();
      });
      servingOptions.appendChild(opt);
    });
  }

  // Custom grams handler
  servingCustomAdd.onclick = () => {
    const g   = parseFloat(servingCustomG.value);
    if (!g || g <= 0) return;
    const cal = cal100 != null ? Math.round(cal100 * g / 100) : 0;
    addFoodEntry(food.description, cal, `${g}g`);
    closeServingSheet();
    closeAddSheet();
  };

  addOverlay.hidden = true;
  servingOverlay.hidden = false;
}

function closeServingSheet() {
  servingOverlay.hidden = true;
  pendingFood = null;
}

// ── Add Entry ──────────────────────────────
function addFoodEntry(name, calories, serving) {
  const day = currentDayData();
  if (!day[state.activeMeal]) day[state.activeMeal] = [];
  day[state.activeMeal].push({ name, calories: Math.round(calories), serving });
  render();
}

// ── Body scroll lock (prevents background scroll on iOS when sheet is open) ──
function lockScroll()   { document.body.style.overflow = 'hidden'; }
function unlockScroll() { document.body.style.overflow = ''; }

// ── FAB / Add Sheet ────────────────────────
document.getElementById('fab-btn').addEventListener('click', openAddSheet);

function openAddSheet() {
  foodSearch.value = '';
  resultsList.innerHTML = '';
  manualWrap.hidden = true;
  toggleManual.hidden = false;
  setActiveMealTab(state.activeMeal);
  addOverlay.hidden = false;
  lockScroll();
  setTimeout(() => foodSearch.focus(), 100);
}

function closeAddSheet() {
  addOverlay.hidden = true;
  unlockScroll();
}

// Close on overlay click
addOverlay.addEventListener('click', e => { if (e.target === addOverlay) closeAddSheet(); });
goalOverlay.addEventListener('click', e => {
  if (e.target === goalOverlay) { goalOverlay.hidden = true; unlockScroll(); }
});
servingOverlay.addEventListener('click', e => {
  if (e.target === servingOverlay) {
    closeServingSheet();
    addOverlay.hidden = false;
    // scroll lock stays active since add sheet re-opens
  }
});

// Meal tabs
mealTabs.querySelectorAll('.meal-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    state.activeMeal = tab.dataset.meal;
    setActiveMealTab(state.activeMeal);
  });
});

function setActiveMealTab(meal) {
  mealTabs.querySelectorAll('.meal-tab').forEach(t => {
    t.classList.toggle('active', t.dataset.meal === meal);
  });
}

// Manual entry
toggleManual.addEventListener('click', () => {
  manualWrap.hidden = !manualWrap.hidden;
  toggleManual.textContent = manualWrap.hidden ? 'Enter manually instead' : 'Hide manual entry';
});

manualAddBtn.addEventListener('click', () => {
  const name = manualName.value.trim();
  const cal  = parseInt(manualCalEl.value, 10);
  const srv  = manualServing.value.trim();
  if (!name || isNaN(cal) || cal < 0) {
    manualName.focus();
    return;
  }
  addFoodEntry(name, cal, srv || '1 serving');
  manualName.value = '';
  manualCalEl.value = '';
  manualServing.value = '';
  closeAddSheet();
});

// ── Goal sheet ─────────────────────────────
const goalDisplayVal = document.getElementById('goal-display-val');
const goalSlider     = document.getElementById('goal-slider');
const goalPresets    = document.getElementById('goal-presets');

function syncGoalUI(val) {
  const clamped = Math.min(Math.max(val, 1200), 4000);
  goalDisplayVal.textContent = val;
  goalInput.value = val;
  goalSlider.value = Math.min(Math.max(clamped, 1200), 4000);
  goalPresets.querySelectorAll('.goal-preset').forEach(p => {
    p.classList.toggle('selected', parseInt(p.dataset.cal) === val);
  });
}

goalSlider.addEventListener('input', () => syncGoalUI(parseInt(goalSlider.value)));
goalInput.addEventListener('input', () => {
  const v = parseInt(goalInput.value);
  if (!isNaN(v) && v >= 500) syncGoalUI(v);
});
goalPresets.querySelectorAll('.goal-preset').forEach(btn => {
  btn.addEventListener('click', () => syncGoalUI(parseInt(btn.dataset.cal)));
});

document.querySelector('.calorie-ring-wrap').addEventListener('click', () => {
  syncGoalUI(state.goal);
  goalOverlay.hidden = false;
  lockScroll();
});

goalSave.addEventListener('click', () => {
  const g = parseInt(goalInput.value, 10);
  if (g >= 500 && g <= 9999) {
    state.goal = g;
    goalOverlay.hidden = true;
    unlockScroll();
    render();
  }
});

goalInput.addEventListener('keydown', e => { if (e.key === 'Enter') goalSave.click(); });

// ── Week Navigation ───────────────────────
prevWeekBtn.addEventListener('click', () => {
  state.weekOffset -= 1;
  // Ensure we have data for this week
  const weekKeys = Object.keys(state.week);
  const targetWeekStart = getWeekStartDate(state.weekOffset);
  const targetWeekKeys = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(targetWeekStart);
    d.setDate(targetWeekStart.getDate() + i);
    const key = d.toISOString().slice(0, 10);
    targetWeekKeys.push(key);
    if (!state.week[key]) {
      state.week[key] = emptyDay();
    }
  }
  // Set active date to the same day of the week
  const currentDayOfWeek = new Date(state.activeDateKey + 'T12:00:00').getDay();
  const targetKey = targetWeekKeys.find(key => new Date(key + 'T12:00:00').getDay() === currentDayOfWeek);
  if (targetKey) state.activeDateKey = targetKey;
  render();
});

nextWeekBtn.addEventListener('click', () => {
  if (state.weekOffset >= 0) return; // Can't go to future
  state.weekOffset += 1;
  // Ensure we have data for this week
  const weekKeys = Object.keys(state.week);
  const targetWeekStart = getWeekStartDate(state.weekOffset);
  const targetWeekKeys = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(targetWeekStart);
    d.setDate(targetWeekStart.getDate() + i);
    const key = d.toISOString().slice(0, 10);
    targetWeekKeys.push(key);
    if (!state.week[key]) {
      state.week[key] = emptyDay();
    }
  }
  // Set active date to the same day of the week
  const currentDayOfWeek = new Date(state.activeDateKey + 'T12:00:00').getDay();
  const targetKey = targetWeekKeys.find(key => new Date(key + 'T12:00:00').getDay() === currentDayOfWeek);
  if (targetKey) state.activeDateKey = targetKey;
  render();
});

function getWeekStartDate(offset = 0) {
  const today = new Date();
  const dow = (today.getDay() + 6) % 7; // Convert Sun=0 to Mon=0
  const monday = new Date(today);
  monday.setDate(today.getDate() - dow + (offset * 7));
  return monday;
}

// ── Keyboard shortcuts ─────────────────────
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    if (!servingOverlay.hidden) { closeServingSheet(); addOverlay.hidden = false; }
    else if (!addOverlay.hidden) closeAddSheet();
    else if (!goalOverlay.hidden) { goalOverlay.hidden = true; unlockScroll(); }
  }
});

// ── Init ───────────────────────────────────
render();
