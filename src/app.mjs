import {
  DEFAULT_STATE,
  SESSIONS,
  WEEKDAYS,
  addDays,
  addLeave,
  buildWeek,
  clone,
  findGaps,
  formatDisplayDate,
  formatRange,
  getPeopleByGroup,
  getPerson,
  isOnLeave,
  normalizeState,
  removeLeave,
  setWardOverride,
  startOfWeekISO,
  todayISO
} from "./rota-core.mjs";

const STORAGE_KEY = "rota-gap-planner-state-v1";
const app = document.querySelector("#app");

let state = loadState();
let currentWeek = startOfWeekISO(state.settings.rotaStart || todayISO());

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return normalizeState(raw ? JSON.parse(raw) : DEFAULT_STATE);
  } catch (error) {
    console.warn("Could not load rota planner state", error);
    return normalizeState(DEFAULT_STATE);
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function uid(prefix) {
  if (crypto.randomUUID) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function roleClass(role) {
  return String(role || "person")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function personLabel(person) {
  return person ? `${person.name} - ${person.role}` : "Unassigned";
}

function parsePersonEntry(entry) {
  const parts = entry
    .split(/\s+-\s+|\s+–\s+|\s+—\s+/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length < 2) {
    return { name: entry.trim(), role: "" };
  }

  return {
    name: parts[0],
    role: parts.slice(1).join(" - ")
  };
}

function roleToGroup(role) {
  return /consultant/i.test(role) ? "core" : "support";
}

function renderPersonChip(personId, dateISO, options = {}) {
  const person = getPerson(state, personId);
  if (!person) {
    return `<span class="chip chip-muted">Unknown</span>`;
  }

  const away = dateISO ? isOnLeave(state, personId, dateISO) : false;
  const classes = [
    "chip",
    `chip-${person.group}`,
    `role-${roleClass(person.role)}`,
    away ? "chip-away" : "",
    options.auto ? "chip-auto" : ""
  ].filter(Boolean).join(" ");

  const detail = away ? "On leave" : person.role;
  return `
    <span class="${classes}" title="${escapeHtml(detail)}">
      ${escapeHtml(person.name)}
      ${away ? '<span class="chip-note">leave</span>' : ""}
      ${options.auto ? '<span class="chip-note">auto</span>' : ""}
    </span>
  `;
}

function renderPersonOptions(selectedId = "", people = state.people) {
  return [
    '<option value="">Select person</option>',
    ...people.map((person) => `
      <option value="${escapeHtml(person.id)}" ${person.id === selectedId ? "selected" : ""}>
        ${escapeHtml(personLabel(person))}
      </option>
    `)
  ].join("");
}

function renderMultiPersonOptions(selectedIds = []) {
  const selected = new Set(selectedIds);
  return state.people.map((person) => `
    <option value="${escapeHtml(person.id)}" ${selected.has(person.id) ? "selected" : ""}>
      ${escapeHtml(person.name)} - ${escapeHtml(person.role)}
    </option>
  `).join("");
}

function renderSummary(gaps) {
  const wardGaps = gaps.filter((gap) => gap.kind === "ward").length;
  const clinicGaps = gaps.filter((gap) => gap.kind === "clinic").length;
  const rangeStart = currentWeek;
  const rangeEnd = addDays(currentWeek, (Number(state.settings.viewWeeks) * 7) - 1);
  const totalGaps = gaps.length;

  return `
    <section class="summary" aria-label="Rota summary">
      <div class="summary-card ${totalGaps ? "summary-alert" : "summary-ok"}">
        <span class="summary-label">Rota status</span>
        <strong>${totalGaps ? `${totalGaps} gap${totalGaps === 1 ? "" : "s"}` : "Covered"}</strong>
        <span>${totalGaps ? "Needs review" : "No gaps found"}</span>
      </div>
      <div class="summary-card ${clinicGaps ? "summary-alert" : ""}">
        <span class="summary-label">Clinic gaps</span>
        <strong>${clinicGaps}</strong>
        <span>Minimum 2 per clinic</span>
      </div>
      <div class="summary-card">
        <span class="summary-label">Ward gaps</span>
        <strong>${wardGaps}</strong>
        <span>${escapeHtml(state.settings.wardName)}</span>
      </div>
      <div class="summary-card">
        <span class="summary-label">Checked range</span>
        <strong>${escapeHtml(formatRange(rangeStart, rangeEnd))}</strong>
        <span>${Number(state.settings.viewWeeks)} week${Number(state.settings.viewWeeks) === 1 ? "" : "s"}</span>
      </div>
    </section>
  `;
}

function renderToolbar() {
  return `
    <header class="topbar">
      <div class="topbar-brand">
        <p class="eyebrow">Thoracic rota</p>
        <h1>Rota gap planner</h1>
      </div>
      <div class="toolbar" aria-label="Week navigation">
        <button class="button button-light" id="prevWeek" type="button">Previous</button>
        <label class="compact-field">
          <span>Week starting</span>
          <input type="date" id="weekPicker" value="${escapeHtml(currentWeek)}">
        </label>
        <button class="button button-light" id="todayWeek" type="button">Today</button>
        <button class="button button-light" id="nextWeek" type="button">Next</button>
        <label class="compact-field">
          <span>Check</span>
          <select id="viewWeeks">
            ${[1, 3, 6, 12].map((weeks) => `
              <option value="${weeks}" ${Number(state.settings.viewWeeks) === weeks ? "selected" : ""}>
                ${weeks} week${weeks === 1 ? "" : "s"}
              </option>
            `).join("")}
          </select>
        </label>
      </div>
    </header>
  `;
}

function renderSidebar() {
  return `
    <aside class="sidebar">
      ${renderLeavePanel()}
      ${renderPeoplePanel()}
      ${renderSettingsPanel()}
    </aside>
  `;
}

function renderLeavePanel() {
  const sortedLeave = [...state.leave].sort((a, b) => a.start.localeCompare(b.start));

  return `
    <section class="panel">
      <div class="panel-heading">
        <h2>Add leave</h2>
        <span class="badge">${state.leave.length}</span>
      </div>
      <form class="stack" id="leaveForm">
        <label>
          Person
          <select id="leavePerson" required>
            ${renderPersonOptions()}
          </select>
        </label>
        <div class="split">
          <label>
            Start
            <input type="date" id="leaveStart" value="${escapeHtml(currentWeek)}" required>
          </label>
          <label>
            End
            <input type="date" id="leaveEnd" value="${escapeHtml(currentWeek)}" required>
          </label>
        </div>
        <label>
          Reason
          <input id="leaveReason" placeholder="Annual leave" maxlength="80">
        </label>
        <button class="button button-primary" type="submit">Add leave</button>
      </form>
      <div class="item-list leave-list">
        ${sortedLeave.length ? sortedLeave.map((leave) => {
          const person = getPerson(state, leave.personId);
          return `
            <div class="list-row">
              <div>
                <strong>${escapeHtml(person ? person.name : "Unknown")}</strong>
                <span>${escapeHtml(formatRange(leave.start, leave.end))}</span>
                <small>${escapeHtml(leave.reason || "Leave")}</small>
              </div>
              <button class="button button-ghost" type="button" data-remove-leave="${escapeHtml(leave.id)}">Remove</button>
            </div>
          `;
        }).join("") : '<p class="empty">No leave added yet.</p>'}
      </div>
    </section>
  `;
}

function renderPeoplePanel() {
  const core = getPeopleByGroup(state, "core");
  const support = getPeopleByGroup(state, "support");

  return `
    <section class="panel">
      <div class="panel-heading">
        <h2>People</h2>
        <span class="badge">${state.people.length}</span>
      </div>
      <div class="people-groups">
        <div>
          <h3>Ward rotation</h3>
          ${core.map((person) => renderPersonRow(person)).join("")}
        </div>
        <div>
          <h3>Clinic team</h3>
          ${support.map((person) => renderPersonRow(person)).join("")}
        </div>
      </div>
      <form class="stack compact-form" id="personForm">
        <label>
          Person
          <input id="personEntry" placeholder="Emma Halkyard - ACP" maxlength="100" required>
        </label>
        <label>
          Group
          <select id="personGroup">
            <option value="auto">Use role</option>
            <option value="support">Clinic team</option>
            <option value="core">Ward rotation</option>
          </select>
        </label>
        <button class="button button-light" type="submit">Add person</button>
      </form>
    </section>
  `;
}

function renderPersonRow(person) {
  return `
    <div class="person-row">
      <span class="person-dot role-${roleClass(person.role)}"></span>
      <div>
        <strong>${escapeHtml(person.name)}</strong>
        <span>${escapeHtml(person.role)}</span>
      </div>
      <button class="button button-ghost" type="button" data-remove-person="${escapeHtml(person.id)}">Remove</button>
    </div>
  `;
}

function renderSettingsPanel() {
  const core = getPeopleByGroup(state, "core");

  return `
    <section class="panel">
      <div class="panel-heading">
        <h2>Ward cycle</h2>
      </div>
      <div class="stack">
        <label>
          Cycle starts
          <input type="date" id="rotaStart" value="${escapeHtml(state.settings.rotaStart)}">
        </label>
        <label>
          Ward name
          <input id="wardName" value="${escapeHtml(state.settings.wardName)}" maxlength="80">
        </label>
        <div class="rotation-list">
          ${(state.settings.wardOrder || []).map((personId, index) => `
            <label>
              Week ${index + 1}
              <select data-ward-order="${index}">
                ${core.map((person) => `
                  <option value="${escapeHtml(person.id)}" ${person.id === personId ? "selected" : ""}>
                    ${escapeHtml(person.name)}
                  </option>
                `).join("")}
              </select>
            </label>
          `).join("")}
        </div>
        <button class="button button-light" type="button" id="resetState">Reset starter data</button>
      </div>
    </section>
  `;
}

function renderMainContent(gaps) {
  const week = buildWeek(state, currentWeek);

  return `
    <main class="content">
      ${renderSummary(gaps)}
      <section class="board-shell">
        <div class="board-heading">
          <div>
            <p class="eyebrow">Week board</p>
            <h2>${escapeHtml(formatRange(currentWeek, addDays(currentWeek, 4)))}</h2>
          </div>
          <span class="board-chip">${escapeHtml(state.settings.wardName)}</span>
        </div>
        <div class="week-board" aria-label="Current week rota">
          ${week.map((day) => renderDayColumn(day)).join("")}
        </div>
      </section>
      <section class="workspace-grid">
        ${renderGapsPanel(gaps)}
        ${renderClinicTemplatesPanel()}
      </section>
    </main>
  `;
}

function renderDayColumn(day) {
  const itemCount = 1 + day.sessions.length;
  return `
    <article class="day-column">
      <div class="day-heading">
        <div>
          <h2>${escapeHtml(day.label)}</h2>
          <span>${escapeHtml(formatDisplayDate(day.date))}</span>
        </div>
        <div class="day-badges">
          <span class="badge badge-soft">${itemCount} item${itemCount === 1 ? "" : "s"}</span>
          ${day.leave.length ? `<span class="badge badge-away">${day.leave.length} away</span>` : ""}
        </div>
      </div>
      ${renderWardCard(day)}
      <div class="session-list">
        ${day.sessions.map((session) => renderSessionCard(session)).join("")}
      </div>
      ${renderDayLeave(day)}
    </article>
  `;
}

function renderWardCard(day) {
  const ward = day.ward;
  const personId = ward.assignedIds[0] || "";
  const person = getPerson(state, personId);
  const core = getPeopleByGroup(state, "core");
  const isClosed = ward.required === 0;
  const wardStatus = isClosed ? "closed" : "open";
  const wardStatusControl = `
    <label class="mini-select">
      Status
      <select data-ward-status="${escapeHtml(day.date)}">
        <option value="open" ${wardStatus === "open" ? "selected" : ""}>Open</option>
        <option value="closed" ${wardStatus === "closed" ? "selected" : ""}>Closed</option>
      </select>
    </label>
  `;

  if (isClosed) {
    return `
      <section class="work-card meeting-card card-neutral">
        <div class="card-topline">
          <span class="work-type">Ward</span>
          <span class="status-pill status-neutral">Closed</span>
        </div>
        <h3>${escapeHtml(ward.label || "Bank holiday")}</h3>
        <p class="location">${escapeHtml(state.settings.wardName)}</p>
        <div class="chip-row">
          <span class="chip chip-muted">No ward cover required</span>
        </div>
        <div class="slot-controls">
          ${wardStatusControl}
        </div>
      </section>
    `;
  }

  return `
    <section class="work-card ward-card ${ward.gap ? "card-gap" : "card-ok"}">
      <div class="card-topline">
        <span class="work-type">Ward</span>
        <span class="status-pill ${ward.gap ? "status-gap" : "status-ok"}">
          ${ward.gap ? "Gap" : "Covered"}
        </span>
      </div>
      <h3>${escapeHtml(state.settings.wardName)}</h3>
      <div class="chip-row">
        ${person ? renderPersonChip(personId, day.date) : '<span class="chip chip-muted">No ward person</span>'}
      </div>
      <div class="slot-controls">
        ${wardStatusControl}
        <label class="mini-select">
          Cover
          <select data-ward-cover="${escapeHtml(day.date)}">
            <option value="">Auto cycle</option>
            ${core.map((corePerson) => `
              <option value="${escapeHtml(corePerson.id)}" ${state.wardOverrides[day.date] === corePerson.id ? "selected" : ""}>
                ${escapeHtml(corePerson.name)}
              </option>
            `).join("")}
          </select>
        </label>
      </div>
    </section>
  `;
}

function renderSessionCard(session) {
  const active = session.activeIds.length;
  const total = session.assignedIds.length;
  const isClinic = session.type === "clinic";
  const status = isClinic
    ? (session.gap ? `${session.shortBy} short` : `${active}/${session.required}`)
    : "Info";

  return `
    <section class="work-card ${isClinic ? "clinic-card" : "meeting-card"} ${session.gap ? "card-gap" : isClinic ? "card-ok" : "card-neutral"}">
      <div class="card-topline">
        <span class="work-type">${escapeHtml(session.session)} ${escapeHtml(session.type)}</span>
        <span class="status-pill ${session.gap ? "status-gap" : isClinic ? "status-ok" : "status-neutral"}">
          ${escapeHtml(status)}
        </span>
      </div>
      <h3>${escapeHtml(session.name)}</h3>
      <p class="location">${escapeHtml(session.location)}</p>
      <div class="chip-row">
        ${session.assignedIds.length
          ? session.assignedIds.map((personId) => renderPersonChip(personId, session.date, {
            auto: session.autoIds.includes(personId)
          })).join("")
          : '<span class="chip chip-muted">No people assigned</span>'}
      </div>
      ${isClinic ? `<p class="coverage-note">${active} available from ${total} assigned. Minimum ${session.required}.</p>` : ""}
      ${renderInlineClinicEditor(session)}
    </section>
  `;
}

function renderInlineClinicEditor(clinic) {
  return `
    <details class="slot-editor">
      <summary>Edit slot</summary>
      <div class="slot-editor-grid">
        <label>
          Name
          <input value="${escapeHtml(clinic.name)}" data-clinic-field="${escapeHtml(clinic.id)}:name">
        </label>
        <label>
          Location
          <input value="${escapeHtml(clinic.location)}" data-clinic-field="${escapeHtml(clinic.id)}:location">
        </label>
        <label>
          Session
          <select data-clinic-field="${escapeHtml(clinic.id)}:session">
            ${SESSIONS.map((session) => `
              <option value="${escapeHtml(session)}" ${clinic.session === session ? "selected" : ""}>${escapeHtml(session)}</option>
            `).join("")}
          </select>
        </label>
        <label>
          Type
          <select data-clinic-field="${escapeHtml(clinic.id)}:type">
            <option value="clinic" ${clinic.type === "clinic" ? "selected" : ""}>Clinic</option>
            <option value="meeting" ${clinic.type === "meeting" ? "selected" : ""}>Meeting</option>
          </select>
        </label>
        <label>
          Minimum
          <input type="number" min="0" max="10" value="${Number(clinic.required || 0)}" data-clinic-field="${escapeHtml(clinic.id)}:required">
        </label>
        <label class="check-row">
          <input type="checkbox" data-clinic-field="${escapeHtml(clinic.id)}:includeLungConsultants" ${clinic.includeLungConsultants ? "checked" : ""}>
          Auto lung
        </label>
        <label class="slot-editor-wide">
          Staff
          <select multiple size="4" data-clinic-staff="${escapeHtml(clinic.id)}">
            ${renderMultiPersonOptions(clinic.staffIds || [])}
          </select>
        </label>
        <button class="button button-ghost slot-editor-remove" type="button" data-remove-clinic="${escapeHtml(clinic.id)}">Remove slot</button>
      </div>
    </details>
  `;
}

function renderDayLeave(day) {
  if (!day.leave.length) {
    return "";
  }

  return `
    <section class="leave-day">
      <h3>Leave</h3>
      <div class="chip-row">
        ${day.leave.map((leave) => renderPersonChip(leave.personId, day.date)).join("")}
      </div>
    </section>
  `;
}

function renderGapsPanel(gaps) {
  return `
    <section class="panel panel-wide">
      <div class="panel-heading">
        <h2>Gaps to fix</h2>
        <span class="badge ${gaps.length ? "badge-alert" : ""}">${gaps.length}</span>
      </div>
      <div class="gap-list">
        ${gaps.length ? gaps.map((gap) => `
          <div class="gap-row">
            <div>
              <strong>${escapeHtml(formatDisplayDate(gap.date))} - ${escapeHtml(gap.session)} - ${escapeHtml(gap.title)}</strong>
              <span>${escapeHtml(gap.location)} needs ${gap.required}, has ${gap.active}; ${gap.shortBy} short.</span>
              <div class="chip-row compact">
                ${gap.assignedIds.length
                  ? gap.assignedIds.map((personId) => renderPersonChip(personId, gap.date)).join("")
                  : '<span class="chip chip-muted">No assignment</span>'}
              </div>
            </div>
          </div>
        `).join("") : '<p class="empty success">No ward or clinic gaps in the selected range.</p>'}
      </div>
    </section>
  `;
}

function renderClinicTemplatesPanel() {
  return `
    <section class="panel panel-wide">
      <div class="panel-heading">
        <h2>Clinic templates</h2>
        <span class="badge">${state.clinicTemplates.length}</span>
      </div>
      <div class="template-list">
        ${state.clinicTemplates.map((clinic) => renderClinicTemplate(clinic)).join("")}
      </div>
      <form class="clinic-form" id="clinicForm">
        <input id="clinicName" placeholder="Clinic or meeting name" required>
        <input id="clinicLocation" placeholder="Location" required>
        <select id="clinicDay">
          ${WEEKDAYS.map((day) => `<option value="${day.index}">${escapeHtml(day.label)}</option>`).join("")}
        </select>
        <select id="clinicSession">
          ${SESSIONS.map((session) => `<option>${escapeHtml(session)}</option>`).join("")}
        </select>
        <select id="clinicType">
          <option value="clinic">Clinic</option>
          <option value="meeting">Meeting</option>
        </select>
        <input id="clinicRequired" type="number" min="0" max="10" value="2" aria-label="Minimum people">
        <label class="check-row">
          <input id="clinicAutoLung" type="checkbox" checked>
          Auto lung consultants
        </label>
        <button class="button button-light" type="submit">Add template</button>
      </form>
    </section>
  `;
}

function renderClinicTemplate(clinic) {
  return `
    <article class="template-row">
      <div class="template-main">
        <input class="plain-input" value="${escapeHtml(clinic.name)}" data-clinic-field="${escapeHtml(clinic.id)}:name" aria-label="Clinic name">
        <input class="plain-input subdued-input" value="${escapeHtml(clinic.location)}" data-clinic-field="${escapeHtml(clinic.id)}:location" aria-label="Clinic location">
      </div>
      <div class="template-controls">
        <select data-clinic-field="${escapeHtml(clinic.id)}:day" aria-label="Clinic day">
          ${WEEKDAYS.map((day) => `
            <option value="${day.index}" ${Number(clinic.day) === day.index ? "selected" : ""}>${escapeHtml(day.label)}</option>
          `).join("")}
        </select>
        <select data-clinic-field="${escapeHtml(clinic.id)}:session" aria-label="Clinic session">
          ${SESSIONS.map((session) => `
            <option value="${escapeHtml(session)}" ${clinic.session === session ? "selected" : ""}>${escapeHtml(session)}</option>
          `).join("")}
        </select>
        <select data-clinic-field="${escapeHtml(clinic.id)}:type" aria-label="Clinic type">
          <option value="clinic" ${clinic.type === "clinic" ? "selected" : ""}>Clinic</option>
          <option value="meeting" ${clinic.type === "meeting" ? "selected" : ""}>Meeting</option>
        </select>
        <input class="number-input" type="number" min="0" max="10" value="${Number(clinic.required || 0)}" data-clinic-field="${escapeHtml(clinic.id)}:required" aria-label="Minimum people">
        <label class="check-row">
          <input type="checkbox" data-clinic-field="${escapeHtml(clinic.id)}:includeLungConsultants" ${clinic.includeLungConsultants ? "checked" : ""}>
          Auto lung
        </label>
        <button class="button button-ghost" type="button" data-remove-clinic="${escapeHtml(clinic.id)}">Remove</button>
      </div>
      <label class="template-staff">
        Staff
        <select multiple size="4" data-clinic-staff="${escapeHtml(clinic.id)}" aria-label="Assigned clinic staff">
          ${renderMultiPersonOptions(clinic.staffIds || [])}
        </select>
      </label>
    </article>
  `;
}

function render() {
  const gaps = findGaps(state, currentWeek, Number(state.settings.viewWeeks || 6));

  app.innerHTML = `
    ${renderToolbar()}
    <div class="app-shell">
      ${renderSidebar()}
      ${renderMainContent(gaps)}
    </div>
  `;

  bindEvents();
}

function bindEvents() {
  document.querySelector("#prevWeek").addEventListener("click", () => {
    currentWeek = addDays(currentWeek, -7);
    render();
  });

  document.querySelector("#nextWeek").addEventListener("click", () => {
    currentWeek = addDays(currentWeek, 7);
    render();
  });

  document.querySelector("#todayWeek").addEventListener("click", () => {
    currentWeek = startOfWeekISO(todayISO());
    render();
  });

  document.querySelector("#weekPicker").addEventListener("change", (event) => {
    currentWeek = startOfWeekISO(event.target.value);
    render();
  });

  document.querySelector("#viewWeeks").addEventListener("change", (event) => {
    state.settings.viewWeeks = Number(event.target.value);
    saveState();
    render();
  });

  document.querySelector("#leaveForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const personId = document.querySelector("#leavePerson").value;
    const start = document.querySelector("#leaveStart").value;
    const end = document.querySelector("#leaveEnd").value;
    const reason = document.querySelector("#leaveReason").value.trim() || "Annual leave";

    if (!personId || !start || !end) {
      return;
    }

    if (end < start) {
      alert("Leave end date must be on or after the start date.");
      return;
    }

    state = addLeave(state, {
      id: uid("leave"),
      personId,
      start,
      end,
      reason
    });
    saveState();
    render();
  });

  document.querySelector("#personForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const entryInput = document.querySelector("#personEntry");
    const groupValue = document.querySelector("#personGroup").value;
    const { name, role } = parsePersonEntry(entryInput.value);

    if (!name || !role) {
      alert("Use the format: Name - role");
      return;
    }

    const group = groupValue === "auto" ? roleToGroup(role) : groupValue;

    const person = {
      id: uid("person"),
      name,
      role,
      group,
      rotaPattern: group === "core" && role === "Consultant" ? "lung" : "none"
    };

    state.people.push(person);
    if (group === "core") {
      state.settings.wardOrder.push(person.id);
    }
    saveState();
    render();
  });

  document.querySelector("#rotaStart").addEventListener("change", (event) => {
    state.settings.rotaStart = startOfWeekISO(event.target.value);
    saveState();
    render();
  });

  document.querySelector("#wardName").addEventListener("change", (event) => {
    state.settings.wardName = event.target.value.trim() || "Ward 12";
    saveState();
    render();
  });

  document.querySelector("#resetState").addEventListener("click", () => {
    if (!confirm("Reset the rota, people, clinics, leave, and cover overrides to the starter setup?")) {
      return;
    }
    state = normalizeState(clone(DEFAULT_STATE));
    currentWeek = startOfWeekISO(state.settings.rotaStart || todayISO());
    saveState();
    render();
  });

  document.querySelector("#clinicForm").addEventListener("submit", (event) => {
    event.preventDefault();
    state.clinicTemplates.push({
      id: uid("clinic"),
      type: document.querySelector("#clinicType").value,
      name: document.querySelector("#clinicName").value.trim(),
      location: document.querySelector("#clinicLocation").value.trim(),
      day: Number(document.querySelector("#clinicDay").value),
      session: document.querySelector("#clinicSession").value,
      required: Number(document.querySelector("#clinicRequired").value || 0),
      includeLungConsultants: document.querySelector("#clinicAutoLung").checked,
      staffIds: []
    });
    saveState();
    render();
  });

  document.querySelectorAll("[data-remove-leave]").forEach((button) => {
    button.addEventListener("click", () => {
      state = removeLeave(state, button.dataset.removeLeave);
      saveState();
      render();
    });
  });

  document.querySelectorAll("[data-remove-person]").forEach((button) => {
    button.addEventListener("click", () => {
      const personId = button.dataset.removePerson;
      const person = getPerson(state, personId);
      const coreCount = getPeopleByGroup(state, "core").length;
      if (person?.group === "core" && coreCount <= 1) {
        alert("Keep at least one person in the ward rotation.");
        return;
      }
      state.people = state.people.filter((person) => person.id !== personId);
      state.leave = state.leave.filter((leave) => leave.personId !== personId);
      state.settings.wardOrder = state.settings.wardOrder.filter((id) => id !== personId);
      Object.entries(state.wardOverrides).forEach(([date, id]) => {
        if (id === personId) {
          delete state.wardOverrides[date];
        }
      });
      state.clinicTemplates = state.clinicTemplates.map((clinic) => ({
        ...clinic,
        staffIds: (clinic.staffIds || []).filter((id) => id !== personId)
      }));
      saveState();
      render();
    });
  });

  document.querySelectorAll("[data-ward-order]").forEach((select) => {
    select.addEventListener("change", () => {
      state.settings.wardOrder[Number(select.dataset.wardOrder)] = select.value;
      saveState();
      render();
    });
  });

  document.querySelectorAll("[data-ward-cover]").forEach((select) => {
    select.addEventListener("change", () => {
      state = setWardOverride(state, select.dataset.wardCover, select.value);
      saveState();
      render();
    });
  });

  document.querySelectorAll("[data-ward-status]").forEach((select) => {
    select.addEventListener("change", () => {
      const dateISO = select.dataset.wardStatus;
      state.wardSlotOverrides = state.wardSlotOverrides || {};

      if (select.value === "closed") {
        state.wardSlotOverrides[dateISO] = { status: "closed", label: "Closed" };
        delete state.wardOverrides[dateISO];
      } else if (state.bankHolidays?.[dateISO]) {
        state.wardSlotOverrides[dateISO] = { status: "open" };
      } else {
        delete state.wardSlotOverrides[dateISO];
      }

      saveState();
      render();
    });
  });

  document.querySelectorAll("[data-clinic-field]").forEach((control) => {
    control.addEventListener("change", () => {
      const [clinicId, field] = control.dataset.clinicField.split(":");
      const clinic = state.clinicTemplates.find((item) => item.id === clinicId);
      if (!clinic) {
        return;
      }

      if (field === "required" || field === "day") {
        clinic[field] = Number(control.value);
      } else if (field === "includeLungConsultants") {
        clinic[field] = control.checked;
      } else {
        clinic[field] = control.value;
      }

      saveState();
      render();
    });
  });

  document.querySelectorAll("[data-clinic-staff]").forEach((select) => {
    select.addEventListener("change", () => {
      const clinic = state.clinicTemplates.find((item) => item.id === select.dataset.clinicStaff);
      if (!clinic) {
        return;
      }
      clinic.staffIds = [...select.selectedOptions].map((option) => option.value);
      saveState();
      render();
    });
  });

  document.querySelectorAll("[data-remove-clinic]").forEach((button) => {
    button.addEventListener("click", () => {
      state.clinicTemplates = state.clinicTemplates.filter((clinic) => clinic.id !== button.dataset.removeClinic);
      saveState();
      render();
    });
  });
}

render();

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./sw.js").catch((error) => {
    console.warn("Service worker registration failed", error);
  });
}
