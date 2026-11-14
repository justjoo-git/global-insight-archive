(() => {
  const DATA = window.GEOSIM_DATA;
  const MAP_COUNTRIES = window.WORLD_MAP_COUNTRIES || [];
  if (!DATA) {
    document.getElementById("tickerHeadline").textContent = "geosim_events.js 데이터를 불러오지 못했습니다.";
    return;
  }

  const SVG_NS = "http://www.w3.org/2000/svg";
  const LON_MIN = -175.0, LON_MAX = 180.0;
  const LAT_MIN = -58.0, LAT_MAX = 82.0;
  const WIDTH = 1000.0, HEIGHT = 500.0;

  const TYPE_META = {
    military: { label: "전쟁/안보", icon: "⚔️", color: "#dc2626" },
    unrest: { label: "시위/내정", icon: "🔥", color: "#d97706" },
    diplomacy: { label: "외교/관계", icon: "🤝", color: "#059669" },
    economy: { label: "경제/제재", icon: "💰", color: "#2563eb" },
  };

  const SUBTYPE_META = {
    military: TYPE_META.military,
    unrest: TYPE_META.unrest,
    diplomacy: TYPE_META.diplomacy,
    economy: TYPE_META.economy,
  };

  const STATUS_COLOR = {
    red: "#ef4444",
    amber: "#f59e0b",
    green: "#10b981",
    gray: "#64748b",
  };

  const POLARITY_ICONS = {
    military: { pos: "🕊️", neg: "⚔️", neu: "🛡️" },
    unrest: { pos: "🌿", neg: "🔥", neu: "📢" },
    diplomacy: { pos: "🤝", neg: "😠", neu: "🌐" },
    economy: { pos: "📈", neg: "📉", neu: "💰" },
  };

  function getPolarityStyle(ev) {
    const t = Number(ev.tension || 0);
    const icons = POLARITY_ICONS[ev.type] || POLARITY_ICONS.diplomacy;
    if (t < 0) {
      return { color: "#10b981", bg: "#ecfdf5", icon: icons.pos, sign: "pos", isCrossedRifles: false };
    }
    if (t > 0) {
      return {
        color: "#ef4444",
        bg: "#fef2f2",
        icon: icons.neg,
        sign: "neg",
        isCrossedRifles: ev.type === "military",
      };
    }
    return { color: "#64748b", bg: "#f8fafc", icon: icons.neu, sign: "neu", isCrossedRifles: false };
  }

  const CROSSED_RIFLES_MARKUP =
    `<g transform="rotate(-42)">` +
      `<path d="M-7.5,-0.9 L5.5,-0.9 L5.5,0.5 L-1.8,0.5 L-3.6,2.1 L-7.8,2.1 L-7.2,0.5 L-7.5,0.5 Z" fill="#b91c1c"/>` +
      `<rect x="1.2" y="-1.6" width="5.8" height="0.8" rx="0.3" fill="#7f1d1d"/>` +
      `<rect x="-0.6" y="0.4" width="1.1" height="2.0" rx="0.2" fill="#7f1d1d"/>` +
    `</g>` +
    `<g transform="scale(-1,1) rotate(-42)">` +
      `<path d="M-7.5,-0.9 L5.5,-0.9 L5.5,0.5 L-1.8,0.5 L-3.6,2.1 L-7.8,2.1 L-7.2,0.5 L-7.5,0.5 Z" fill="#b91c1c"/>` +
      `<rect x="1.2" y="-1.6" width="5.8" height="0.8" rx="0.3" fill="#7f1d1d"/>` +
      `<rect x="-0.6" y="0.4" width="1.1" height="2.0" rx="0.2" fill="#7f1d1d"/>` +
    `</g>`;

  function appendSvgBadgeIcon(vg, pStyle) {
    if (pStyle.isCrossedRifles) {
      const ig = svgEl("g", {});
      ig.innerHTML = CROSSED_RIFLES_MARKUP;
      vg.appendChild(ig);
      return;
    }
    const iconText = svgEl("text", {
      x: 0, y: 0.5,
      "text-anchor": "middle",
      "dominant-baseline": "central",
      "font-size": "13",
    });
    iconText.textContent = pStyle.icon;
    vg.appendChild(iconText);
  }

  function polarityIconHtml(pStyle) {
    if (pStyle.isCrossedRifles) {
      return `<svg viewBox="-9 -9 18 18" width="14" height="14" style="vertical-align:-2px;display:inline-block" aria-hidden="true">${CROSSED_RIFLES_MARKUP}</svg>`;
    }
    return pStyle.icon;
  }

  const state = {
    dates: DATA.dates || [],
    currentDate: (DATA.dates && DATA.dates[DATA.dates.length - 1]) || "",
    activeTheme: "all",
    windowDays: 7,
    selectedCountries: new Set(),
    lastFocusedCountry: null,
    isPlayingEvents: false,
    isTimelapse: false,
    speed: 1,
    activeEventIdx: 0,
    filteredEvents: [],
    animFrameId: null,
    eventTimerId: null,
    timelapseTimerId: null,
    vx: 122,
    vy: 54,
    vw: 795,
    vh: 380,
    panFrameId: null,
    didDrag: false,
    popupAnchorMeta: null,
    popupOffset: { dx: 0, dy: 0 },
    calYear: Number(((DATA.dates && DATA.dates[DATA.dates.length - 1]) || "2026-11-14").slice(0, 4)),
    calMonth: Number(((DATA.dates && DATA.dates[DATA.dates.length - 1]) || "2026-11-14").slice(5, 7)),
  };

  const ALL_DATES_SET = new Set(state.dates);
  const LATEST_DATE = state.dates[state.dates.length - 1] || "";

  // DOM Elements
  const els = {
    mapDeskCalendar: document.getElementById("mapDeskCalendar"),
    calYearNum: document.getElementById("calYearNum"),
    calWeekday: document.getElementById("calWeekday"),
    calMonthCard: document.getElementById("calMonthCard"),
    calMonthNum: document.getElementById("calMonthNum"),
    calDayCard: document.getElementById("calDayCard"),
    calDayNum: document.getElementById("calDayNum"),
    calendarTriggerWrap: document.getElementById("calendarTriggerWrap"),
    currentDateBtn: document.getElementById("currentDateBtn"),
    calendarPopover: document.getElementById("calendarPopover"),
    calPrevMonthBtn: document.getElementById("calPrevMonthBtn"),
    calNextMonthBtn: document.getElementById("calNextMonthBtn"),
    calYearSelect: document.getElementById("calYearSelect"),
    calMonthSelect: document.getElementById("calMonthSelect"),
    calDaysGrid: document.getElementById("calDaysGrid"),
    calGoLatestBtn: document.getElementById("calGoLatestBtn"),
    calCloseBtn: document.getElementById("calCloseBtn"),
    prevDateBtn: document.getElementById("prevDateBtn"),
    nextDateBtn: document.getElementById("nextDateBtn"),
    timelapseBtn: document.getElementById("timelapseBtn"),
    globalTensionBar: document.getElementById("globalTensionBar"),
    globalTensionVal: document.getElementById("globalTensionVal"),
    globalTensionBadge: document.getElementById("globalTensionBadge"),
    selectedChips: document.getElementById("selectedChips"),
    resetSelectionBtn: document.getElementById("resetSelectionBtn"),
    gridLayer: document.getElementById("gridLayer"),
    countriesMapLayer: document.getElementById("countriesMapLayer"),
    arcsLayer: document.getElementById("arcsLayer"),
    countriesLayer: document.getElementById("countriesLayer"),
    animLayer: document.getElementById("animLayer"),
    worldSvg: document.getElementById("worldSvg"),
    mapBg: document.getElementById("mapBg"),
    mapTooltip: document.getElementById("mapTooltip"),
    mapEventPopup: document.getElementById("mapEventPopup"),
    dossierCard: document.getElementById("dossierCard"),
    dossierFlag: document.getElementById("dossierFlag"),
    dossierName: document.getElementById("dossierName"),
    dossierMeta: document.getElementById("dossierMeta"),
    dossierScore: document.getElementById("dossierScore"),
    dossierScoreBar: document.getElementById("dossierScoreBar"),
    dossierAxes: document.getElementById("dossierAxes"),
    dossierTrend: document.getElementById("dossierTrend"),
    dossierCounts: document.getElementById("dossierCounts"),
    dossierInfo: document.getElementById("dossierInfo"),
    dossierEventCount: document.getElementById("dossierEventCount"),
    dossierEventsList: document.getElementById("dossierEventsList"),
    closeDossierBtn: document.getElementById("closeDossierBtn"),
    playEventsBtn: document.getElementById("playEventsBtn"),
    speedBtn: document.getElementById("speedBtn"),
    tickerTypeBadge: document.getElementById("tickerTypeBadge"),
    tickerRoute: document.getElementById("tickerRoute"),
    tickerHeadline: document.getElementById("tickerHeadline"),
    tickerQueue: document.getElementById("tickerQueue"),
    zoomInBtn: document.getElementById("zoomInBtn"),
    zoomOutBtn: document.getElementById("zoomOutBtn"),
    zoomResetBtn: document.getElementById("zoomResetBtn"),
  };

  function project(lat, lon) {
    const x = ((lon - LON_MIN) / (LON_MAX - LON_MIN)) * WIDTH;
    const y = ((LAT_MAX - lat) / (LAT_MAX - LAT_MIN)) * HEIGHT;
    return { x, y };
  }

  function applyViewBox() {
    els.worldSvg.setAttribute(
      "viewBox",
      `${state.vx.toFixed(1)} ${state.vy.toFixed(1)} ${state.vw.toFixed(1)} ${state.vh.toFixed(1)}`
    );
    const zoomScale = +(state.vw / 795).toFixed(4);
    if (els.countriesLayer) {
      els.countriesLayer.querySelectorAll(".country-node").forEach((node) => {
        const nx = node.getAttribute("data-x");
        const ny = node.getAttribute("data-y");
        if (nx !== null && ny !== null) {
          node.setAttribute("transform", `translate(${nx}, ${ny}) scale(${zoomScale})`);
        }
      });
    }
    positionMapEventPopup(true);
  }

  function clampViewBox() {
    state.vw = Math.max(180, Math.min(980, state.vw));
    state.vh = state.vw * (380 / 795);
    state.vx = Math.max(0, Math.min(1000 - state.vw, state.vx));
    state.vy = Math.max(0, Math.min(500 - state.vh, state.vy));
  }

  function zoomMap(factor, clientX = null, clientY = null) {
    const rect = els.worldSvg.getBoundingClientRect();
    let fx = 0.5, fy = 0.5;
    if (clientX !== null && clientY !== null && rect.width && rect.height) {
      fx = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      fy = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));
    }
    const anchorX = state.vx + state.vw * fx;
    const anchorY = state.vy + state.vh * fy;
    state.vw = Math.max(180, Math.min(980, state.vw * factor));
    state.vh = state.vw * (380 / 795);
    state.vx = anchorX - state.vw * fx;
    state.vy = anchorY - state.vh * fy;
    clampViewBox();
    applyViewBox();
  }

  function resetZoom() {
    state.vx = 122;
    state.vy = 54;
    state.vw = 795;
    state.vh = 380;
    applyViewBox();
  }

  function syncViewBox() {
    applyViewBox();
  }

  function svgEl(tag, attrs = {}) {
    const el = document.createElementNS(SVG_NS, tag);
    for (const [k, v] of Object.entries(attrs)) {
      el.setAttribute(k, v);
    }
    return el;
  }

  // Build static grid & world country borders once
  const countryPolyMap = new Map();

  function initBaseMap() {
    for (let x = 100; x < WIDTH; x += 100) {
      els.gridLayer.appendChild(svgEl("line", { x1: x, y1: 0, x2: x, y2: HEIGHT }));
    }
    for (let y = 80; y < HEIGHT; y += 80) {
      els.gridLayer.appendChild(svgEl("line", { x1: 0, y1: y, x2: WIDTH, y2: y }));
    }
    const frag = document.createDocumentFragment();
    for (const item of MAP_COUNTRIES) {
      const path = svgEl("path", {
        d: item.d,
        class: `land-poly${item.k ? " interactive" : ""}`,
      });
      if (item.k) {
        path.dataset.country = item.k;
        path.addEventListener("click", (e) => {
          e.stopPropagation();
          toggleCountry(item.k);
        });
        path.addEventListener("mouseenter", (e) => {
          const meta = DATA.countries[item.k];
          const st = (DATA.statusByDate[state.currentDate] || {})[item.k];
          if (meta) showTooltip(e, item.k, meta, st);
        });
        path.addEventListener("mousemove", moveTooltip);
        path.addEventListener("mouseleave", hideTooltip);
        if (!countryPolyMap.has(item.k)) countryPolyMap.set(item.k, []);
        countryPolyMap.get(item.k).push(path);
      }
      frag.appendChild(path);
    }
    els.countriesMapLayer.appendChild(frag);
  }

  function initDateSelect() {
    if (!els.calYearSelect || !els.calMonthSelect) return;
    const years = Array.from(new Set(state.dates.map((d) => Number(d.slice(0, 4))))).sort((a, b) => a - b);
    els.calYearSelect.innerHTML = "";
    years.forEach((y) => {
      const opt = document.createElement("option");
      opt.value = String(y);
      opt.textContent = `${y}년`;
      els.calYearSelect.appendChild(opt);
    });
    els.calMonthSelect.innerHTML = "";
    for (let m = 1; m <= 12; m++) {
      const opt = document.createElement("option");
      opt.value = String(m);
      opt.textContent = `${m}월`;
      els.calMonthSelect.appendChild(opt);
    }
  }

  function renderCalendarGrid() {
    if (!els.calDaysGrid) return;
    const yr = state.calYear;
    const mo = state.calMonth;
    els.calYearSelect.value = String(yr);
    els.calMonthSelect.value = String(mo);

    const firstDayOfWeek = new Date(yr, mo - 1, 1).getDay();
    const daysInMonth = new Date(yr, mo, 0).getDate();
    const ymPrefix = `${yr}-${String(mo).padStart(2, "0")}`;

    const cells = [];
    for (let i = 0; i < firstDayOfWeek; i++) {
      cells.push(`<div class="cal-day-cell cal-day-empty"></div>`);
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const dStr = `${ymPrefix}-${String(d).padStart(2, "0")}`;
      const isAvail = ALL_DATES_SET.has(dStr);
      const isSel = dStr === state.currentDate;
      if (isAvail) {
        const selClass = isSel ? " cal-day-selected" : "";
        cells.push(
          `<button type="button" class="cal-day-cell cal-day-available${selClass}" data-date="${dStr}" title="${dStr} 보기">${d}</button>`
        );
      } else {
        cells.push(
          `<button type="button" class="cal-day-cell cal-day-disabled" disabled title="수집된 데이터 없음">${d}</button>`
        );
      }
    }
    els.calDaysGrid.innerHTML = cells.join("");
  }

  function openCalendarPopover() {
    if (!els.calendarPopover) return;
    const parts = (state.currentDate || LATEST_DATE).split("-");
    if (parts.length === 3) {
      state.calYear = Number(parts[0]);
      state.calMonth = Number(parts[1]);
    }
    renderCalendarGrid();
    els.calendarPopover.hidden = false;
    if (els.currentDateBtn) els.currentDateBtn.setAttribute("aria-expanded", "true");
  }

  function closeCalendarPopover() {
    if (!els.calendarPopover) return;
    els.calendarPopover.hidden = true;
    if (els.currentDateBtn) els.currentDateBtn.setAttribute("aria-expanded", "false");
  }

  function matchesTheme(ev, theme) {
    if (!theme || theme === "all") return true;
    const t = Number(ev.tension || 0);
    if (theme === "war") return ev.type === "military" && t > 0;
    if (theme === "unrest") return ev.type === "unrest" && t >= 0;
    if (theme === "friendly") return (ev.type === "diplomacy" || ev.type === "military") && t < 0;
    if (theme === "diplo_neg") return ev.type === "diplomacy" && t > 0;
    if (theme === "eco_neg") return ev.type === "economy" && t > 0;
    return true;
  }

  function getWindowDates() {
    const idx = state.dates.indexOf(state.currentDate);
    if (idx < 0) return state.currentDate ? [state.currentDate] : [];
    const days = Math.max(1, Number(state.windowDays || 1));
    const startIdx = Math.max(0, idx - days + 1);
    return state.dates.slice(startIdx, idx + 1);
  }

  function getFilteredEvents() {
    const winDates = getWindowDates();
    const out = [];
    for (let i = winDates.length - 1; i >= 0; i--) {
      const dStr = winDates[i];
      const raw = DATA.eventsByDate[dStr] || [];
      for (const ev of raw) {
        if (!matchesTheme(ev, state.activeTheme)) continue;
        if (state.selectedCountries.size > 0) {
          const hitFrom =
            state.selectedCountries.has(ev.from) ||
            (ev.fromList && ev.fromList.some((k) => state.selectedCountries.has(k)));
          const hitTo = ev.to && state.selectedCountries.has(ev.to);
          if (!hitFrom && !hitTo) continue;
        }
        out.push({ ...ev, _date: dStr });
      }
    }
    return out;
  }

  function toggleCountry(cKey) {
    if (state.didDrag) {
      state.didDrag = false;
      return;
    }
    if (state.selectedCountries.has(cKey)) {
      state.selectedCountries.clear();
      state.lastFocusedCountry = null;
    } else {
      state.selectedCountries.clear();
      state.selectedCountries.add(cKey);
      state.lastFocusedCountry = cKey;
    }
    state.activeEventIdx = 0;
    renderAll();
  }

  function clearSelection() {
    if (state.selectedCountries.size === 0) return;
    state.selectedCountries.clear();
    state.lastFocusedCountry = null;
    state.activeEventIdx = 0;
    renderAll();
  }

  function triggerCalFlip(cardEl) {
    if (!cardEl) return;
    cardEl.classList.remove("flipping");
    void cardEl.offsetWidth;
    cardEl.classList.add("flipping");
  }

  function renderHeader() {
    if (els.currentDateBtn && state.currentDate) {
      const [cy, cm, cd] = state.currentDate.split("-");
      const wk = ["일", "월", "화", "수", "목", "금", "토"][new Date(Number(cy), Number(cm) - 1, Number(cd)).getDay()];
      els.currentDateBtn.textContent = `📅 ${state.currentDate} (${wk})`;
    }
    if (state.currentDate && els.calYearNum && els.calMonthNum && els.calDayNum && els.calWeekday) {
      const [yr, mo, dy] = state.currentDate.split("-");
      const prevMo = els.calMonthNum.textContent;
      const prevDy = els.calDayNum.textContent;
      const newMo = String(Number(mo));
      const newDy = String(Number(dy));

      els.calYearNum.textContent = yr;
      els.calMonthNum.textContent = newMo;
      els.calDayNum.textContent = newDy;

      if (prevMo && prevMo !== newMo) triggerCalFlip(els.calMonthCard);
      if (prevDy && prevDy !== newDy) triggerCalFlip(els.calDayCard);

      const dt = new Date(`${state.currentDate}T00:00:00`);
      const weekdays = ["일", "월", "화", "수", "목", "금", "토"];
      const dayIdx = Number.isNaN(dt.getTime()) ? -1 : dt.getDay();
      els.calWeekday.textContent = dayIdx >= 0 ? `${weekdays[dayIdx]}요일` : "";
      els.calWeekday.classList.toggle("sun", dayIdx === 0);
      els.calWeekday.classList.toggle("sat", dayIdx === 6);
    }
    const t = DATA.globalTension[state.currentDate] ?? 50;
    els.globalTensionVal.textContent = t;
    els.globalTensionBar.style.width = `${t}%`;

    let badge = "안정", bg = "rgba(5,150,105,0.12)", fg = "#065f46";
    if (t >= 65) {
      badge = "위기"; bg = "rgba(220,38,38,0.12)"; fg = "#991b1b";
    } else if (t >= 52) {
      badge = "긴장"; bg = "rgba(217,119,6,0.14)"; fg = "#92400e";
    } else if (t >= 42) {
      badge = "경계"; bg = "rgba(3,105,161,0.12)"; fg = "#075985";
    }
    els.globalTensionBadge.textContent = badge;
    els.globalTensionBadge.style.background = bg;
    els.globalTensionBadge.style.color = fg;
  }

  function renderSelectionChips() {
    els.selectedChips.innerHTML = "";
    if (state.selectedCountries.size === 0) {
      const hint = document.createElement("span");
      hint.className = "hint-text";
      hint.textContent = "국가 클릭: 단독 집중 · 재클릭 또는 배경 클릭: 전체 보기";
      els.selectedChips.appendChild(hint);
      return;
    }
    for (const cKey of state.selectedCountries) {
      const meta = DATA.countries[cKey];
      if (!meta) continue;
      const chip = document.createElement("button");
      chip.className = "country-chip";
      chip.textContent = `${meta.flag} ${meta.ko} ×`;
      chip.title = "클릭하여 선택 해제";
      chip.addEventListener("click", () => toggleCountry(cKey));
      els.selectedChips.appendChild(chip);
    }
  }

  function renderCountries() {
    els.countriesLayer.innerHTML = "";
    const statusMap = DATA.statusByDate[state.currentDate] || {};
    const hasSel = state.selectedCountries.size > 0;
    const hasTheme = state.activeTheme !== "all";
    const hasFocus = hasSel || hasTheme;

    // Determine countries connected to selected countries and aggregate bilateral tension
    const connectedSet = new Set(state.selectedCountries);
    const partnerTensionSum = new Map();
    if (hasSel) {
      const addPartnerScore = (pKey, tVal) => {
        if (!pKey || state.selectedCountries.has(pKey)) return;
        connectedSet.add(pKey);
        partnerTensionSum.set(pKey, (partnerTensionSum.get(pKey) || 0) + tVal);
      };
      for (const ev of state.filteredEvents) {
        const tVal = Number(ev.tension || 0);
        const hitFrom =
          state.selectedCountries.has(ev.from) ||
          (ev.fromList && ev.fromList.some((k) => state.selectedCountries.has(k)));
        if (hitFrom && ev.to) addPartnerScore(ev.to, tVal);
        if (ev.to && state.selectedCountries.has(ev.to)) {
          addPartnerScore(ev.from, tVal);
          if (ev.fromList) ev.fromList.forEach((k) => addPartnerScore(k, tVal));
        }
      }
    }

    const getDisplayColor = (cKey, st) => {
      if (hasSel && !state.selectedCountries.has(cKey) && partnerTensionSum.has(cKey)) {
        const net = partnerTensionSum.get(cKey);
        if (net > 0) return "red";
        if (net < 0) return "green";
        return "amber";
      }
      return st ? st.color : "gray";
    };

    const activeInEvents = new Set();
    for (const ev of state.filteredEvents) {
      if (ev.from) activeInEvents.add(ev.from);
      if (ev.to) activeInEvents.add(ev.to);
      if (ev.fromList) ev.fromList.forEach((k) => activeInEvents.add(k));
    }
    if (state.activeTheme === "eco_neg") {
      for (const [cKey, st] of Object.entries(statusMap)) {
        if ((st.eco || 0) >= 55) activeInEvents.add(cKey);
      }
    }

    const focusSet = hasSel ? connectedSet : activeInEvents;

    // Update country border polygon highlights
    for (const [cKey, polys] of countryPolyMap.entries()) {
      const st = statusMap[cKey];
      const colorName = getDisplayColor(cKey, st);
      const isSelected = state.selectedCountries.has(cKey);
      const isDimmed = hasFocus && !focusSet.has(cKey);
      for (const poly of polys) {
        poly.setAttribute(
          "class",
          `land-poly interactive${colorName !== "gray" ? ` status-${colorName}` : ""}${isSelected ? " selected" : ""}${isDimmed ? " dimmed" : ""}`
        );
      }
    }

    const CORE_COUNTRIES = new Set([
      "korea", "usa", "china", "japan", "russia", "uk", "france", "germany",
      "india", "australia", "canada", "brazil", "italy", "spain", "ukraine",
      "israel", "iran", "saudi-arabia", "turkey", "indonesia", "vietnam", "mexico",
    ]);

    const zoomScale = +(state.vw / 795).toFixed(4);
    const frag = document.createDocumentFragment();
    for (const [cKey, meta] of Object.entries(DATA.countries)) {
      const st = statusMap[cKey];
      const isSelected = state.selectedCountries.has(cKey);
      // Only show pins for major core countries, selected countries, or countries with active news/status
      if (!st && !isSelected && !activeInEvents.has(cKey) && !CORE_COUNTRIES.has(cKey)) {
        continue;
      }

      const { x, y } = project(meta.lat, meta.lon);
      const colorName = getDisplayColor(cKey, st);
      const fill = STATUS_COLOR[colorName] || STATUS_COLOR.gray;
      const isDimmed = hasFocus && !focusSet.has(cKey);

      const g = svgEl("g", {
        class: `country-node${isSelected ? " selected" : ""}${isDimmed ? " dimmed" : ""}`,
        "data-country": cKey,
        "data-x": x.toFixed(2),
        "data-y": y.toFixed(2),
        transform: `translate(${x.toFixed(2)}, ${y.toFixed(2)}) scale(${zoomScale})`,
      });

      const showRing = isSelected || (hasTheme && !isDimmed) || (!hasFocus && colorName === "red");
      if (showRing) {
        const ringColor = isSelected
          ? "#0284c7"
          : hasTheme
            ? (state.activeTheme === "friendly" ? "#10b981" : "#ef4444")
            : fill;
        g.appendChild(svgEl("circle", {
          cx: 0, cy: 0, r: isSelected ? 7.5 : 6,
          stroke: ringColor,
          class: "pulse-ring",
        }));
      }

      const core = svgEl("circle", {
        cx: 0, cy: 0,
        r: isSelected ? 6 : (st ? 4.4 : 3.2),
        fill: isSelected ? "#0284c7" : fill,
        stroke: isSelected ? "#ffffff" : "#fcfbf9",
        "stroke-width": isSelected ? 1.6 : 1.0,
        class: "country-core",
      });
      if (colorName === "red" && !isDimmed) {
        core.setAttribute("filter", "url(#glowRed)");
      }
      g.appendChild(core);

      const label = svgEl("text", { x: 0, y: -7.5, class: "country-label" });
      label.textContent = meta.ko;
      g.appendChild(label);

      g.addEventListener("click", (e) => {
        e.stopPropagation();
        toggleCountry(cKey);
      });
      g.addEventListener("mouseenter", (e) => showTooltip(e, cKey, meta, st));
      g.addEventListener("mousemove", moveTooltip);
      g.addEventListener("mouseleave", hideTooltip);

      frag.appendChild(g);
    }
    els.countriesLayer.appendChild(frag);
  }

  function getTrendDirection(score, daily) {
    const diff = (daily ?? score) - score;
    if (diff >= 3) return { symbol: "▲", cls: "up", label: "상승 중" };
    if (diff <= -3) return { symbol: "▼", cls: "down", label: "하강 중" };
    return { symbol: "▶", cls: "flat", label: "보합" };
  }

  function showTooltip(e, cKey, meta, st) {
    let scoreTxt = "보도 없음";
    if (st) {
      const daily = st.daily ?? st.score;
      const dir = getTrendDirection(st.score, daily);
      const statusSuffix = st.asOf && st.asOf !== state.currentDate
        ? `(${st.asOf} 유지)`
        : "";
      scoreTxt = `긴장도 ${st.score} · 당일 ${daily} <span class="trend-dir ${dir.cls}">${dir.symbol}</span> ${statusSuffix}`.trim();
    }
    els.mapTooltip.innerHTML = `<strong>${meta.flag} ${meta.ko}</strong> <span style="color:#64748b">(${meta.region})</span><br><span style="color:#0369a1">${scoreTxt}</span>`;
    els.mapTooltip.classList.remove("hidden");
    moveTooltip(e);
  }

  function moveTooltip(e) {
    const stage = els.mapTooltip.parentElement;
    if (!stage) return;
    const rect = stage.getBoundingClientRect();
    const relX = e.clientX - rect.left;
    const relY = e.clientY - rect.top;
    const tipW = els.mapTooltip.offsetWidth || 190;
    const tipH = els.mapTooltip.offsetHeight || 44;
    const pad = 10;
    const gap = 14;

    const preferLeft = relX > rect.width * 0.55;
    const preferTop = relY > rect.height * 0.45;
    const rawCandidates = [
      { x: relX - tipW - gap, y: relY - tipH - gap, order: (preferLeft ? 0 : 2) + (preferTop ? 0 : 1) },
      { x: relX + gap, y: relY - tipH - gap, order: (preferLeft ? 2 : 0) + (preferTop ? 0 : 1) },
      { x: relX - tipW - gap, y: relY + gap, order: (preferLeft ? 0 : 2) + (preferTop ? 1 : 0) },
      { x: relX + gap, y: relY + gap, order: (preferLeft ? 2 : 0) + (preferTop ? 1 : 0) },
    ];
    rawCandidates.sort((a, b) => a.order - b.order);

    const ctm = els.worldSvg ? els.worldSvg.getScreenCTM() : null;
    const pinPts = [];
    if (ctm) {
      Object.values(DATA.countries).forEach((meta) => {
        const pt = project(meta.lat, meta.lon);
        pinPts.push({
          x: pt.x * ctm.a + ctm.e - rect.left,
          y: pt.y * ctm.d + ctm.f - rect.top,
        });
      });
    }

    let best = null;
    let bestPenalty = Infinity;
    for (const c of rawCandidates) {
      const oob =
        (c.x < pad ? pad - c.x : 0) +
        (c.x + tipW > rect.width - pad ? c.x + tipW - (rect.width - pad) : 0) +
        (c.y < pad ? pad - c.y : 0) +
        (c.y + tipH > rect.height - pad ? c.y + tipH - (rect.height - pad) : 0);

      const cx = Math.max(pad, Math.min(rect.width - tipW - pad, c.x));
      const cy = Math.max(pad, Math.min(rect.height - tipH - pad, c.y));

      const coversCursor =
        relX >= cx - 6 && relX <= cx + tipW + 6 && relY >= cy - 6 && relY <= cy + tipH + 6;

      let pinHits = 0;
      for (const p of pinPts) {
        if (p.x >= cx - 10 && p.x <= cx + tipW + 10 && p.y >= cy - 10 && p.y <= cy + tipH + 10) {
          pinHits++;
        }
      }

      const penalty = oob * 5 + (coversCursor ? 500 : 0) + pinHits * 15 + c.order;
      if (penalty < bestPenalty) {
        bestPenalty = penalty;
        best = { x: cx, y: cy };
      }
    }

    els.mapTooltip.style.left = `${Math.round(best.x)}px`;
    els.mapTooltip.style.top = `${Math.round(best.y)}px`;
  }

  function hideTooltip() {
    els.mapTooltip.classList.add("hidden");
  }

  function makeArcPath(fromKey, toKey) {
    const a = DATA.countries[fromKey];
    const b = DATA.countries[toKey];
    if (!a || !b) return null;
    const p1 = project(a.lat, a.lon);
    const p2 = project(b.lat, b.lon);
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const dist = Math.hypot(dx, dy);
    const mx = (p1.x + p2.x) / 2;
    const my = (p1.y + p2.y) / 2 - Math.min(75, dist * 0.25);
    return {
      d: `M ${p1.x} ${p1.y} Q ${mx} ${my} ${p2.x} ${p2.y}`,
      p1,
      p2,
    };
  }

  function formatEventRoute(ev, compact = false) {
    const fromMeta = DATA.countries[ev.from];
    const toMeta = ev.to ? DATA.countries[ev.to] : null;
    if (!fromMeta) return "-";
    if (ev.fromList && ev.fromList.length > 1 && toMeta) {
      const grp = ev.groupLabel || `${fromMeta.flag} ${fromMeta.ko} 외 ${ev.fromList.length - 1}개국`;
      return compact ? `${grp}↔${toMeta.ko}` : `${grp} ↔ ${toMeta.flag} ${toMeta.ko}`;
    }
    if (toMeta) {
      return compact ? `${fromMeta.ko}↔${toMeta.ko}` : `${fromMeta.flag} ${fromMeta.ko} ↔ ${toMeta.flag} ${toMeta.ko}`;
    }
    return compact ? fromMeta.ko : `${fromMeta.flag} ${fromMeta.ko} (국내)`;
  }

  function renderBackgroundArcs(showActive = state.isPlayingEvents) {
    els.arcsLayer.innerHTML = "";
    const frag = document.createDocumentFragment();
    const hasTheme = state.activeTheme !== "all";
    const aggMap = new Map();

    state.filteredEvents.forEach((ev, idx) => {
      if (!ev.to || !DATA.countries[ev.to]) return;
      const isActive = showActive && idx === state.activeEventIdx;
      const pStyle = getPolarityStyle(ev);
      const sources = ev.fromList && ev.fromList.length > 1 ? ev.fromList : [ev.from];
      sources.forEach((fKey) => {
        if (isActive) {
          const arc = makeArcPath(fKey, ev.to);
          if (!arc) return;
          frag.appendChild(svgEl("path", {
            d: arc.d,
            class: `event-arc ${ev.type} active`,
            style: `stroke:${pStyle.color};`,
          }));
          return;
        }
        const pair = [fKey, ev.to].sort().join("|");
        const key = `${pair}|${pStyle.sign}`;
        const prev = aggMap.get(key);
        if (prev) {
          prev.count += 1;
        } else {
          aggMap.set(key, { from: fKey, to: ev.to, ev, pStyle, count: 1 });
        }
      });
    });

    for (const item of aggMap.values()) {
      const arc = makeArcPath(item.from, item.to);
      if (!arc) continue;
      const sw = Math.min(3.6, 1.2 + Math.log2(item.count) * 0.65).toFixed(2);
      const op = hasTheme ? Math.min(0.88, 0.48 + Math.log2(item.count) * 0.12).toFixed(2) : "0.35";
      frag.appendChild(svgEl("path", {
        d: arc.d,
        class: `event-arc ${item.ev.type} bg`,
        style: `stroke:${item.pStyle.color};stroke-width:${sw}px;stroke-opacity:${op};`,
      }));
    }
    els.arcsLayer.appendChild(frag);
  }

  function summarizePopupText(text, maxLen = 40) {
    const clean = (text || "").replace(/\s+/g, " ").trim();
    if (clean.length <= maxLen) return clean;
    const cut = clean.slice(0, maxLen - 1);
    const comma = cut.indexOf(",");
    if (comma > 14) return cut.slice(0, comma) + "…";
    const sp = cut.lastIndexOf(" ");
    if (sp > maxLen * 0.55) return cut.slice(0, sp) + "…";
    return cut + "…";
  }

  function positionMapEventPopup(instant = false) {
    if (!state.popupAnchorMeta || els.mapEventPopup.classList.contains("hidden")) return;
    const ctm = els.worldSvg.getScreenCTM();
    const stage = els.worldSvg.parentElement;
    if (!ctm || !stage) return;
    const stageRect = stage.getBoundingClientRect();
    const pt = project(state.popupAnchorMeta.lat, state.popupAnchorMeta.lon);
    const px = pt.x * ctm.a + ctm.e - stageRect.left;
    const py = pt.y * ctm.d + ctm.f - stageRect.top;
    els.mapEventPopup.style.transition = instant ? "none" : "";
    els.mapEventPopup.style.left = `${Math.round(px + state.popupOffset.dx)}px`;
    els.mapEventPopup.style.top = `${Math.round(py + state.popupOffset.dy)}px`;
  }

  function showMapEventPopup(ev, fromMeta, toMeta, tMeta) {
    if (!fromMeta) {
      state.popupAnchorMeta = null;
      els.mapEventPopup.classList.add("hidden");
      return;
    }

    // Anchor below the focused country if single-selected, otherwise below destination (or source)
    let anchorMeta = toMeta || fromMeta;
    if (state.selectedCountries.size === 1 && state.lastFocusedCountry && DATA.countries[state.lastFocusedCountry]) {
      anchorMeta = DATA.countries[state.lastFocusedCountry];
    }
    state.popupAnchorMeta = anchorMeta;

    const sMeta = SUBTYPE_META[ev.sub] || tMeta;
    const pStyle = getPolarityStyle(ev);
    const routeText = formatEventRoute(ev, false);

    els.mapEventPopup.className = `map-event-popup ${ev.type}`;
    els.mapEventPopup.innerHTML = `
      <div class="mep-meta-row">
        <span class="mep-badge ${ev.type}" style="color:${pStyle.color};background:${pStyle.bg};border:1px solid ${pStyle.color}33">${polarityIconHtml(pStyle)} ${sMeta.label}</span>
        <span class="mep-date">${state.currentDate}</span>
      </div>
      <div class="mep-head">
        <span class="mep-route">${routeText}</span>
      </div>
      <div class="mep-body">${ev.short || summarizePopupText(ev.headline)}</div>
    `;

    const ctm = els.worldSvg.getScreenCTM();
    const stage = els.worldSvg.parentElement;
    if (!ctm || !stage) return;
    const stageRect = stage.getBoundingClientRect();
    const pt = project(anchorMeta.lat, anchorMeta.lon);
    const px = pt.x * ctm.a + ctm.e - stageRect.left;
    const py = pt.y * ctm.d + ctm.f - stageRect.top;

    const popupW = Math.min(245, stageRect.width - 24);
    const maxRight = stageRect.width - 12;

    let left = Math.round(px - popupW / 2);
    left = Math.max(12, Math.min(maxRight - popupW, left));

    let top = Math.round(py + (state.selectedCountries.size > 0 ? 24 : 18));
    if (top + 115 > stageRect.height) {
      top = Math.max(12, Math.round(py - 110));
    }

    state.popupOffset = { dx: left - px, dy: top - py };
    els.mapEventPopup.style.transition = "";
    els.mapEventPopup.style.left = `${left}px`;
    els.mapEventPopup.style.top = `${top}px`;
  }

  function stopEventAnimation() {
    if (state.animFrameId) {
      cancelAnimationFrame(state.animFrameId);
      state.animFrameId = null;
    }
    if (state.eventTimerId) {
      clearTimeout(state.eventTimerId);
      state.eventTimerId = null;
    }
  }

  function playActiveEvent() {
    stopEventAnimation();
    els.animLayer.innerHTML = "";

    const events = state.filteredEvents;
    if (!events.length) {
      els.tickerTypeBadge.className = "ev-badge";
      els.tickerTypeBadge.textContent = "NONE";
      els.tickerRoute.textContent = "-";
      els.tickerHeadline.textContent = "선택된 조건에 해당하는 이벤트가 없습니다.";
      els.mapEventPopup.classList.add("hidden");
      renderTickerQueue();
      return;
    }

    if (state.activeEventIdx >= events.length) state.activeEventIdx = 0;
    const ev = events[state.activeEventIdx];
    const tMeta = TYPE_META[ev.type] || TYPE_META.diplomacy;
    const sMeta = SUBTYPE_META[ev.sub] || tMeta;
    const pStyle = getPolarityStyle(ev);
    const fromMeta = DATA.countries[ev.from];
    const toMeta = ev.to ? DATA.countries[ev.to] : null;

    // Update ticker UI
    els.tickerTypeBadge.className = `ev-badge ${ev.type}`;
    els.tickerTypeBadge.style.color = pStyle.color;
    els.tickerTypeBadge.style.background = pStyle.bg;
    els.tickerTypeBadge.style.borderColor = `${pStyle.color}44`;
    els.tickerTypeBadge.innerHTML = `${polarityIconHtml(pStyle)} ${sMeta.label}`;
    els.tickerRoute.textContent = formatEventRoute(ev, false);
    els.tickerHeadline.textContent = ev.headline;

    showMapEventPopup(ev, fromMeta, toMeta, tMeta);
    renderBackgroundArcs(true);
    renderTickerQueue(true);
    highlightDossierEvent(ev.id);

    // Draw SVG animation for active event (bidirectional arcs & polarity-colored badges)
    if (toMeta) {
      const sources = ev.fromList && ev.fromList.length > 1 ? ev.fromList : [ev.from];

      const createBadgeGroup = (p1) => {
        const vg = svgEl("g", {
          transform: `translate(${p1.x}, ${p1.y})`,
          filter: "url(#glowSoft)",
        });
        vg.appendChild(svgEl("circle", {
          cx: 0, cy: 0, r: 12,
          fill: pStyle.bg,
          stroke: pStyle.color,
          "stroke-width": "2.2",
        }));
        appendSvgBadgeIcon(vg, pStyle);
        return vg;
      };

      const movers = [];
      sources.forEach((fKey) => {
        const arc = makeArcPath(fKey, ev.to);
        if (!arc) return;
        const animPath = svgEl("path", {
          d: arc.d,
          class: `event-arc ${ev.type} active`,
          style: `stroke:${pStyle.color};`,
          filter: "url(#glowSoft)",
        });
        els.arcsLayer.appendChild(animPath);
        els.animLayer.appendChild(svgEl("circle", {
          cx: arc.p1.x, cy: arc.p1.y, r: 6,
          stroke: pStyle.color,
          class: "ripple-wave",
        }));
        const vg = createBadgeGroup(arc.p1);
        els.animLayer.appendChild(vg);
        movers.push({ animPath, totalLen: animPath.getTotalLength(), vg, p1: arc.p1 });
      });

      if (movers.length > 0) {
        const period = 1600;
        const start = performance.now();
        let lastLeg = 0;

        function step(now) {
          const rawPhase = (now - start) / period;
          const leg = Math.floor(rawPhase);
          const localT = rawPhase - leg;
          const eased = 0.5 - 0.5 * Math.cos(Math.PI * localT);
          const prog = leg % 2 === 0 ? eased : 1 - eased;

          for (const m of movers) {
            const dist = prog * m.totalLen;
            const pt = m.animPath.getPointAtLength(dist);
            m.vg.setAttribute("transform", `translate(${pt.x}, ${pt.y})`);
          }
          if (leg > lastLeg) {
            lastLeg = leg;
            const hitPts = leg % 2 === 1 ? [project(toMeta.lat, toMeta.lon)] : movers.map((m) => m.p1);
            hitPts.forEach((hitPt) => {
              const ripple = svgEl("circle", {
                cx: hitPt.x, cy: hitPt.y, r: 7,
                stroke: pStyle.color,
                class: "ripple-wave",
              });
              els.animLayer.appendChild(ripple);
              setTimeout(() => ripple.remove(), 1100);
            });
          }
          state.animFrameId = requestAnimationFrame(step);
        }
        state.animFrameId = requestAnimationFrame(step);
      }
    } else if (fromMeta) {
      const pt = project(fromMeta.lat, fromMeta.lon);
      els.animLayer.appendChild(svgEl("circle", {
        cx: pt.x, cy: pt.y, r: 6.5,
        stroke: pStyle.color,
        class: "ripple-wave",
      }));
      const vg = svgEl("g", {
        transform: `translate(${pt.x}, ${pt.y - 16})`,
        filter: "url(#glowSoft)",
      });
      vg.appendChild(svgEl("circle", {
        cx: 0, cy: 0, r: 12,
        fill: pStyle.bg,
        stroke: pStyle.color,
        "stroke-width": "2.2",
      }));
      appendSvgBadgeIcon(vg, pStyle);
      els.animLayer.appendChild(vg);
    }

    if (state.isPlayingEvents && !state.isTimelapse && events.length > 1) {
      const switchMs = Math.round(4000 / state.speed);
      state.eventTimerId = setTimeout(() => {
        state.activeEventIdx = (state.activeEventIdx + 1) % events.length;
        playActiveEvent();
      }, switchMs);
    }
  }

  function renderTickerQueue(showActive = state.isPlayingEvents) {
    els.tickerQueue.innerHTML = "";
    const frag = document.createDocumentFragment();
    state.filteredEvents.forEach((ev, idx) => {
      const btn = document.createElement("button");
      const isActive = showActive && idx === state.activeEventIdx;
      btn.className = `q-dot${isActive ? " active" : ""}`;
      btn.title = ev.headline;
      btn.addEventListener("click", () => {
        state.activeEventIdx = idx;
        playActiveEvent();
      });
      frag.appendChild(btn);
    });
    els.tickerQueue.appendChild(frag);
  }

  function renderDossierCard() {
    if (state.selectedCountries.size === 0 || !state.lastFocusedCountry) {
      els.dossierCard.classList.add("hidden");
      return;
    }
    const cKey = state.lastFocusedCountry;
    const meta = DATA.countries[cKey];
    if (!meta) return;

    const statusMap = DATA.statusByDate[state.currentDate] || {};
    const st = statusMap[cKey];
    const score = st ? st.score : 40;

    els.dossierFlag.textContent = meta.flag;
    els.dossierName.textContent = state.selectedCountries.size > 1
      ? `${meta.ko} (외 ${state.selectedCountries.size - 1}개국 선택)`
      : `${meta.ko} (${meta.en})`;
    els.dossierMeta.textContent = `${meta.region} · 수도 ${meta.capital || "-"}`;
    if (st) {
      const daily = st.daily ?? score;
      const dir = getTrendDirection(score, daily);
      const carriedNote = st.asOf && st.asOf !== state.currentDate ? ` <span style="color:#64748b;font-size:10.5px;">(${st.asOf} 유지)</span>` : "";
      els.dossierScore.innerHTML = `${score} / 100 <span class="daily-chip" title="누적 평균 대비 당일 긴장도 (${dir.label})">당일 ${daily} <span class="trend-dir ${dir.cls}">${dir.symbol}</span></span>${carriedNote}`;
    } else {
      els.dossierScore.textContent = "보도 없음";
    }
    els.dossierScoreBar.style.width = `${score}%`;

    renderDossierAxes(st);
    renderDossierTrend(cKey);

    els.dossierCounts.innerHTML = st
      ? `
        <span class="stat-pill">⚔️ 군사 ${st.m}</span>
        <span class="stat-pill">🔥 시위 ${st.u}</span>
        <span class="stat-pill">✈️ 외교 ${st.d}</span>
        <span class="stat-pill">💲 경제 ${st.e}</span>
      `
      : `<span class="stat-pill">추출 이벤트 없음</span>`;

    els.dossierInfo.textContent = `${meta.system || ""} · ${meta.economy || ""}`.replace(/^\s*·\s*|\s*·\s*$/g, "");

    let displayEvents = state.filteredEvents;
    let isCarriedRef = false;
    if (displayEvents.length === 0 && st && st.asOf && st.asOf !== state.currentDate) {
      const refRaw = DATA.eventsByDate[st.asOf] || [];
      displayEvents = refRaw.filter(
        (ev) => ev.from === cKey || ev.to === cKey || (ev.fromList && ev.fromList.includes(cKey))
      );
      isCarriedRef = displayEvents.length > 0;
    }

    const winLabel = state.windowDays > 1 ? ` · 최근 ${state.windowDays}일` : "";
    els.dossierEventCount.textContent = isCarriedRef
      ? `${displayEvents.length} · ${st.asOf} 유지`
      : `${displayEvents.length}${winLabel}`;
    els.dossierEventsList.innerHTML = "";
    const frag = document.createDocumentFragment();
    displayEvents.forEach((ev, idx) => {
      const li = document.createElement("li");
      li.className = "dossier-event-item";
      li.dataset.evId = ev.id;
      const pStyle = getPolarityStyle(ev);
      const route = formatEventRoute(ev, true);
      const dateTag = state.windowDays > 1 && ev._date ? `<span style="color:#64748b;font-weight:500;margin-right:4px;">[${ev._date.slice(5)}]</span>` : "";
      li.innerHTML = `<div style="color:${pStyle.color};font-weight:700;margin-bottom:2px;">${dateTag}${polarityIconHtml(pStyle)} ${route}</div><div>${ev.headline}</div>`;
      if (!isCarriedRef) {
        li.addEventListener("click", () => {
          state.activeEventIdx = idx;
          playActiveEvent();
        });
      }
      frag.appendChild(li);
    });
    els.dossierEventsList.appendChild(frag);
    els.dossierCard.classList.remove("hidden");
  }

  function axisBarColor(val) {
    if (val >= 68) return "#ef4444";
    if (val >= 48) return "#f59e0b";
    return "#10b981";
  }

  function renderDossierAxes(st) {
    if (!els.dossierAxes) return;
    if (!st) {
      els.dossierAxes.innerHTML = "";
      return;
    }
    const axes = [
      { label: "외교·안보", val: st.dip ?? st.score },
      { label: "국내·사회", val: st.dom ?? st.score },
      { label: "경제·산업", val: st.eco ?? st.score },
    ];
    els.dossierAxes.innerHTML = axes.map((a) => `
      <div class="axis-row">
        <span class="axis-lbl">${a.label}</span>
        <div class="axis-track"><div class="axis-fill" style="width:${a.val}%;background:${axisBarColor(a.val)}"></div></div>
        <span class="axis-num" style="color:${axisBarColor(a.val)}">${a.val}</span>
      </div>
    `).join("");
  }

  function renderDossierTrend(cKey) {
    if (!els.dossierTrend) return;
    const endIdx = state.dates.indexOf(state.currentDate);
    if (endIdx < 0) {
      els.dossierTrend.innerHTML = "";
      return;
    }

    const [ey, em, ed] = state.currentDate.split("-").map(Number);
    const cutoffDate = new Date(Date.UTC(ey - 1, em - 1, ed)).toISOString().slice(0, 10);

    const rawPts = [];
    for (let i = 0; i <= endIdx; i++) {
      const d = state.dates[i];
      if (d < cutoffDate) continue;
      const st = (DATA.statusByDate[d] || {})[cKey];
      if (st) {
        rawPts.push({
          d,
          score: st.score,
          daily: st.daily ?? st.score,
          dip: st.dip ?? st.score,
          dom: st.dom ?? st.score,
          eco: st.eco ?? st.score,
        });
      }
    }
    if (rawPts.length < 2) {
      els.dossierTrend.innerHTML = `<div class="trend-head"><span>최근 1년 추이</span><span>데이터 축적 중</span></div>`;
      return;
    }

    // Smooth high-density series with a gentle centered moving average, preserving endpoints
    const radius = rawPts.length > 180 ? 3 : rawPts.length > 80 ? 2 : rawPts.length > 35 ? 1 : 0;
    const smoothed = radius === 0 ? rawPts : rawPts.map((p, idx) => {
      if (idx === 0 || idx === rawPts.length - 1) return p;
      const lo = Math.max(0, idx - radius);
      const hi = Math.min(rawPts.length - 1, idx + radius);
      let sScore = 0, sDip = 0, sDom = 0, sEco = 0;
      const cnt = hi - lo + 1;
      for (let j = lo; j <= hi; j++) {
        sScore += rawPts[j].score;
        sDip += rawPts[j].dip;
        sDom += rawPts[j].dom;
        sEco += rawPts[j].eco;
      }
      return {
        d: p.d,
        score: sScore / cnt,
        dip: sDip / cnt,
        dom: sDom / cnt,
        eco: sEco / cnt,
      };
    });

    // Downsample to ~64 evenly-spaced points for clean SVG rendering
    const MAX_PTS = 64;
    let pts = smoothed;
    if (smoothed.length > MAX_PTS) {
      pts = [];
      for (let k = 0; k < MAX_PTS; k++) {
        const idx = Math.round((k / (MAX_PTS - 1)) * (smoothed.length - 1));
        pts.push(smoothed[idx]);
      }
    }

    const W = 260, H = 104, PAD = 6;
    const xAt = (idx) => PAD + (idx / (pts.length - 1)) * (W - PAD * 2);
    const yAt = (val) => H - PAD - ((Math.max(10, Math.min(95, val)) - 10) / 85) * (H - PAD * 2);
    const clampY = (y) => Math.max(PAD, Math.min(H - PAD, y));

    const toSmoothPath = (key) => {
      const coords = pts.map((p, idx) => ({ x: xAt(idx), y: yAt(p[key]) }));
      if (coords.length < 2) return "";
      let dStr = `M ${coords[0].x.toFixed(1)},${coords[0].y.toFixed(1)}`;
      const t = 0.7;
      for (let i = 0; i < coords.length - 1; i++) {
        const p0 = coords[Math.max(0, i - 1)];
        const p1 = coords[i];
        const p2 = coords[i + 1];
        const p3 = coords[Math.min(coords.length - 1, i + 2)];
        const cp1x = p1.x + ((p2.x - p0.x) / 6) * t;
        const cp1y = clampY(p1.y + ((p2.y - p0.y) / 6) * t);
        const cp2x = p2.x - ((p3.x - p1.x) / 6) * t;
        const cp2y = clampY(p2.y - ((p3.y - p1.y) / 6) * t);
        dStr += ` C ${cp1x.toFixed(1)},${cp1y.toFixed(1)} ${cp2x.toFixed(1)},${cp2y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`;
      }
      return dStr;
    };

    const last = rawPts[rawPts.length - 1];
    const lx = xAt(pts.length - 1).toFixed(1);
    const ly = yAt(last.score).toFixed(1);
    const scorePath = toSmoothPath("score");
    const areaPath = `${scorePath} L ${lx},${H - PAD} L ${PAD},${H - PAD} Z`;

    els.dossierTrend.innerHTML = `
      <div class="trend-head">
        <span>최근 1년 추이</span>
        <div class="trend-legend">
          <span><i style="background:#111111"></i>종합</span>
          <span><i style="background:#0284c7"></i>외교</span>
          <span><i style="background:#d97706"></i>국내</span>
          <span><i style="background:#059669"></i>경제</span>
        </div>
      </div>
      <svg class="trend-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
        <line x1="${PAD}" y1="${yAt(68).toFixed(1)}" x2="${W - PAD}" y2="${yAt(68).toFixed(1)}" stroke="rgba(220,38,38,0.28)" stroke-dasharray="3 3" stroke-width="0.8" />
        <line x1="${PAD}" y1="${yAt(48).toFixed(1)}" x2="${W - PAD}" y2="${yAt(48).toFixed(1)}" stroke="rgba(217,119,6,0.25)" stroke-dasharray="3 3" stroke-width="0.8" />
        <path d="${areaPath}" fill="rgba(17,17,17,0.07)" />
        <path d="${toSmoothPath("dip")}" fill="none" stroke="#0284c7" stroke-width="1.15" stroke-opacity="0.78" />
        <path d="${toSmoothPath("dom")}" fill="none" stroke="#d97706" stroke-width="1.15" stroke-opacity="0.78" />
        <path d="${toSmoothPath("eco")}" fill="none" stroke="#059669" stroke-width="1.15" stroke-opacity="0.78" />
        <path d="${scorePath}" fill="none" stroke="#111111" stroke-width="1.9" />
        <circle cx="${lx}" cy="${ly}" r="3" fill="#0284c7" stroke="#ffffff" stroke-width="1.2" />
      </svg>
      <div class="trend-dates">
        <span>${rawPts[0].d.slice(2)}</span>
        <span>${last.d.slice(2)} (평균 ${last.score} · 당일 ${last.daily ?? last.score})</span>
      </div>
    `;
  }

  function highlightDossierEvent(evId) {
    const items = els.dossierEventsList.querySelectorAll(".dossier-event-item");
    items.forEach((item) => {
      item.classList.toggle("active", item.dataset.evId === evId);
    });
  }

  function stepDate(delta) {
    const idx = state.dates.indexOf(state.currentDate);
    if (idx === -1) return;
    const nextIdx = Math.max(0, Math.min(state.dates.length - 1, idx + delta));
    if (nextIdx !== idx) {
      state.currentDate = state.dates[nextIdx];
      state.activeEventIdx = 0;
      renderAll();
    }
  }

  function toggleTimelapse() {
    state.isTimelapse = !state.isTimelapse;
    els.timelapseBtn.classList.toggle("active", state.isTimelapse);
    els.timelapseBtn.textContent = state.isTimelapse ? "⏹ 타임랩스 중지" : "⏱ 타임랩스";

    if (state.timelapseTimerId) {
      clearInterval(state.timelapseTimerId);
      state.timelapseTimerId = null;
    }

    if (state.isTimelapse) {
      // Start from 14 days before end if currently at the very latest date
      const curIdx = state.dates.indexOf(state.currentDate);
      if (curIdx >= state.dates.length - 1) {
        state.currentDate = state.dates[Math.max(0, state.dates.length - 15)];
        renderAll();
      }
      const intervalMs = Math.round(3400 / state.speed);
      state.timelapseTimerId = setInterval(() => {
        const idx = state.dates.indexOf(state.currentDate);
        if (idx >= state.dates.length - 1) {
          toggleTimelapse();
          return;
        }
        stepDate(1);
      }, intervalMs);
    } else {
      playActiveEvent();
    }
  }

  function renderStaticReadyState() {
    stopEventAnimation();
    els.animLayer.innerHTML = "";
    state.popupAnchorMeta = null;
    els.mapEventPopup.classList.add("hidden");
    renderBackgroundArcs(false);
    renderTickerQueue(false);
    els.tickerTypeBadge.className = "ev-badge";
    els.tickerTypeBadge.style.color = "";
    els.tickerTypeBadge.style.background = "";
    els.tickerTypeBadge.style.borderColor = "";
    els.tickerTypeBadge.textContent = "READY";
    els.tickerRoute.textContent = `${state.windowDays}일 · ${state.filteredEvents.length}건`;
    els.tickerHeadline.textContent = "국가를 클릭해 상세 정보를 확인하거나 ▶ 버튼을 눌러 시뮬레이션을 시작하세요.";
  }

  function resetAllState() {
    if (state.isTimelapse) toggleTimelapse();
    state.selectedCountries.clear();
    state.lastFocusedCountry = null;
    state.activeTheme = "all";
    state.windowDays = 7;
    document.querySelectorAll(".filter-btn").forEach((b) => {
      b.classList.toggle("active", b.dataset.theme === "all");
    });
    document.querySelectorAll(".win-btn").forEach((b) => {
      b.classList.toggle("active", Number(b.dataset.days) === 7);
    });
    state.isPlayingEvents = false;
    els.playEventsBtn.textContent = "▶";
    els.playEventsBtn.classList.remove("playing");
    state.activeEventIdx = 0;
    resetZoom();
    renderAll();
  }

  function renderAll() {
    state.filteredEvents = getFilteredEvents();
    renderHeader();
    renderSelectionChips();
    renderCountries();
    renderDossierCard();
    syncViewBox(state.lastFocusedCountry, true);
    if (state.isPlayingEvents) {
      playActiveEvent();
    } else {
      renderStaticReadyState();
    }
  }

  // Event Listeners
  const toggleCalendar = (e) => {
    e.stopPropagation();
    if (els.calendarPopover && els.calendarPopover.hidden) {
      openCalendarPopover();
    } else {
      closeCalendarPopover();
    }
  };
  if (els.currentDateBtn) els.currentDateBtn.addEventListener("click", toggleCalendar);
  if (els.mapDeskCalendar) els.mapDeskCalendar.addEventListener("click", toggleCalendar);

  if (els.calYearSelect) {
    els.calYearSelect.addEventListener("change", () => {
      state.calYear = Number(els.calYearSelect.value);
      renderCalendarGrid();
    });
  }
  if (els.calMonthSelect) {
    els.calMonthSelect.addEventListener("change", () => {
      state.calMonth = Number(els.calMonthSelect.value);
      renderCalendarGrid();
    });
  }
  if (els.calPrevMonthBtn) {
    els.calPrevMonthBtn.addEventListener("click", () => {
      state.calMonth -= 1;
      if (state.calMonth < 1) { state.calMonth = 12; state.calYear -= 1; }
      renderCalendarGrid();
    });
  }
  if (els.calNextMonthBtn) {
    els.calNextMonthBtn.addEventListener("click", () => {
      state.calMonth += 1;
      if (state.calMonth > 12) { state.calMonth = 1; state.calYear += 1; }
      renderCalendarGrid();
    });
  }
  if (els.calDaysGrid) {
    els.calDaysGrid.addEventListener("click", (e) => {
      const dayBtn = e.target.closest(".cal-day-available");
      if (!dayBtn) return;
      const targetDate = dayBtn.getAttribute("data-date");
      if (targetDate) {
        state.currentDate = targetDate;
        state.activeEventIdx = 0;
        closeCalendarPopover();
        renderAll();
      }
    });
  }
  if (els.calGoLatestBtn) {
    els.calGoLatestBtn.addEventListener("click", () => {
      if (LATEST_DATE) {
        state.currentDate = LATEST_DATE;
        state.activeEventIdx = 0;
        closeCalendarPopover();
        renderAll();
      }
    });
  }
  if (els.calCloseBtn) els.calCloseBtn.addEventListener("click", closeCalendarPopover);

  document.addEventListener("click", (e) => {
    if (
      els.calendarPopover && !els.calendarPopover.hidden &&
      els.calendarTriggerWrap && !els.calendarTriggerWrap.contains(e.target) &&
      (!els.mapDeskCalendar || !els.mapDeskCalendar.contains(e.target))
    ) {
      closeCalendarPopover();
    }
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && els.calendarPopover && !els.calendarPopover.hidden) {
      closeCalendarPopover();
    }
  });
  els.prevDateBtn.addEventListener("click", () => stepDate(-1));
  els.nextDateBtn.addEventListener("click", () => stepDate(1));
  els.timelapseBtn.addEventListener("click", toggleTimelapse);

  document.querySelectorAll(".win-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".win-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      state.windowDays = Number(btn.dataset.days) || 7;
      state.activeEventIdx = 0;
      renderAll();
    });
  });

  document.querySelectorAll(".filter-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".filter-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      state.activeTheme = btn.dataset.theme || "all";
      state.activeEventIdx = 0;
      renderAll();
    });
  });

  els.mapBg.addEventListener("click", () => {
    if (state.didDrag) {
      state.didDrag = false;
      return;
    }
    clearSelection();
  });

  // 2D Drag panning & mouse-wheel zoom on map
  let dragStart = null;
  els.worldSvg.addEventListener("mousedown", (e) => {
    dragStart = { x: e.clientX, y: e.clientY, vx: state.vx, vy: state.vy };
    state.didDrag = false;
    els.worldSvg.classList.add("dragging");
  });
  window.addEventListener("mousemove", (e) => {
    if (!dragStart) return;
    const dxPx = e.clientX - dragStart.x;
    const dyPx = e.clientY - dragStart.y;
    if (Math.hypot(dxPx, dyPx) > 4) state.didDrag = true;
    const rect = els.worldSvg.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    state.vx = dragStart.vx - (dxPx / rect.width) * state.vw;
    state.vy = dragStart.vy - (dyPx / rect.height) * state.vh;
    clampViewBox();
    applyViewBox();
  });
  window.addEventListener("mouseup", () => {
    if (dragStart) {
      dragStart = null;
      els.worldSvg.classList.remove("dragging");
    }
  });
  els.worldSvg.addEventListener("wheel", (e) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 0.88 : 1.14;
    zoomMap(factor, e.clientX, e.clientY);
  }, { passive: false });

  if (els.zoomInBtn) els.zoomInBtn.addEventListener("click", () => zoomMap(0.78));
  if (els.zoomOutBtn) els.zoomOutBtn.addEventListener("click", () => zoomMap(1.28));
  if (els.zoomResetBtn) els.zoomResetBtn.addEventListener("click", resetZoom);
  window.addEventListener("resize", () => syncViewBox());
  els.resetSelectionBtn.addEventListener("click", resetAllState);
  els.closeDossierBtn.addEventListener("click", clearSelection);

  els.playEventsBtn.addEventListener("click", () => {
    state.isPlayingEvents = !state.isPlayingEvents;
    els.playEventsBtn.textContent = state.isPlayingEvents ? "⏸" : "▶";
    els.playEventsBtn.classList.toggle("playing", state.isPlayingEvents);
    if (state.isPlayingEvents) {
      playActiveEvent();
    } else {
      renderStaticReadyState();
    }
  });

  const SPEED_STEPS = [0.5, 1, 2];
  els.speedBtn.addEventListener("click", () => {
    const nextIdx = (SPEED_STEPS.indexOf(state.speed) + 1) % SPEED_STEPS.length;
    state.speed = SPEED_STEPS[nextIdx];
    els.speedBtn.textContent = `${state.speed}x`;
    if (state.isTimelapse) {
      toggleTimelapse();
      toggleTimelapse();
    } else if (state.isPlayingEvents) {
      playActiveEvent();
    }
  });

  // Boot
  initBaseMap();
  initDateSelect();
  const urlParams = new URLSearchParams(window.location.search);
  const paramDate = urlParams.get("date");
  if (paramDate && state.dates.includes(paramDate)) {
    state.currentDate = paramDate;
  }
  const paramCountry = urlParams.get("country");
  if (paramCountry && DATA.countries && DATA.countries[paramCountry]) {
    state.selectedCountries.add(paramCountry);
    state.lastFocusedCountry = paramCountry;
  }
  renderAll();
})();

