export const WEEKDAYS = [
  { index: 1, key: "mon", label: "Monday" },
  { index: 2, key: "tue", label: "Tuesday" },
  { index: 3, key: "wed", label: "Wednesday" },
  { index: 4, key: "thu", label: "Thursday" },
  { index: 5, key: "fri", label: "Friday" }
];

export const SESSIONS = ["AM", "PM", "All day"];

export const DEFAULT_STATE = {
  schemaVersion: 1,
  settings: {
    rotaStart: "2026-04-27",
    wardName: "Ward 12",
    wardOrder: ["igor", "daniel", "maria"],
    viewWeeks: 6
  },
  people: [
    {
      id: "igor",
      name: "Igor Randulfe",
      role: "Consultant",
      group: "core",
      rotaPattern: "lung"
    },
    {
      id: "daniel",
      name: "Daniel Neto",
      role: "Consultant",
      group: "core",
      rotaPattern: "lung"
    },
    {
      id: "maria",
      name: "Maria Michaelidou",
      role: "Endocrine consultant",
      group: "core",
      rotaPattern: "unconfigured"
    },
    {
      id: "junior-fellow",
      name: "Junior fellow",
      role: "Junior fellow",
      group: "support",
      rotaPattern: "none"
    },
    {
      id: "senior-fellow",
      name: "Senior fellow",
      role: "Senior fellow",
      group: "support",
      rotaPattern: "none"
    },
    {
      id: "spr",
      name: "SPR",
      role: "SPR",
      group: "support",
      rotaPattern: "none"
    },
    {
      id: "acp",
      name: "Advanced care practitioner",
      role: "ACP",
      group: "support",
      rotaPattern: "none"
    }
  ],
  clinicTemplates: [
    {
      id: "christie-mon-pm",
      type: "clinic",
      name: "Christie clinic",
      location: "Christie",
      day: 1,
      session: "PM",
      required: 2,
      includeLungConsultants: true,
      staffIds: ["senior-fellow", "acp"]
    },
    {
      id: "wyth-tue-am",
      type: "clinic",
      name: "Wythenshawe clinic",
      location: "Wythenshawe",
      day: 2,
      session: "AM",
      required: 2,
      includeLungConsultants: true,
      staffIds: ["junior-fellow", "spr"]
    },
    {
      id: "wyth-tue-pm",
      type: "clinic",
      name: "Wythenshawe clinic",
      location: "Wythenshawe",
      day: 2,
      session: "PM",
      required: 2,
      includeLungConsultants: true,
      staffIds: ["senior-fellow", "acp"]
    },
    {
      id: "mdt-thu-pm",
      type: "meeting",
      name: "Thoracic MDT",
      location: "Online",
      day: 4,
      session: "PM",
      required: 0,
      includeLungConsultants: true,
      staffIds: []
    },
    {
      id: "ward-meeting-fri-am",
      type: "meeting",
      name: "Ward meeting",
      location: "Ward 12",
      day: 5,
      session: "AM",
      required: 0,
      includeLungConsultants: true,
      staffIds: []
    },
    {
      id: "wyth-fri-am",
      type: "clinic",
      name: "Wythenshawe clinic",
      location: "Wythenshawe",
      day: 5,
      session: "AM",
      required: 2,
      includeLungConsultants: true,
      staffIds: ["junior-fellow", "spr"]
    }
  ],
  leave: [],
  wardOverrides: {}
};

export function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export function normalizeState(input) {
  const base = clone(DEFAULT_STATE);

  if (!input || typeof input !== "object") {
    return base;
  }

  const state = {
    schemaVersion: 1,
    settings: { ...base.settings, ...(input.settings || {}) },
    people: Array.isArray(input.people) ? input.people : base.people,
    clinicTemplates: Array.isArray(input.clinicTemplates)
      ? input.clinicTemplates
      : base.clinicTemplates,
    leave: Array.isArray(input.leave) ? input.leave : base.leave,
    wardOverrides: input.wardOverrides && typeof input.wardOverrides === "object"
      ? input.wardOverrides
      : base.wardOverrides
  };

  const seededPeople = new Map(base.people.map((person) => [person.id, person]));
  state.people = state.people.map((person) => {
    const seeded = seededPeople.get(person.id);
    if (!seeded) {
      return person;
    }
    return {
      ...person,
      name: seeded.name,
      role: seeded.role,
      group: seeded.group,
      rotaPattern: seeded.rotaPattern
    };
  });

  const coreIds = state.people
    .filter((person) => person.group === "core")
    .map((person) => person.id);

  const personIds = new Set(state.people.map((person) => person.id));
  state.clinicTemplates = state.clinicTemplates.map((clinic) => ({
    ...clinic,
    staffIds: (clinic.staffIds || []).filter((id) => personIds.has(id))
  }));

  state.settings.wardOrder = (state.settings.wardOrder || [])
    .filter((id) => coreIds.includes(id));

  if (!state.settings.wardOrder.length) {
    state.settings.wardOrder = coreIds.slice(0, 3);
  }

  return state;
}

export function parseISODate(iso) {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function toISODate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function todayISO() {
  return toISODate(new Date());
}

export function addDays(iso, days) {
  const date = parseISODate(iso);
  date.setDate(date.getDate() + days);
  return toISODate(date);
}

export function daysBetween(startISO, endISO) {
  const start = parseISODate(startISO);
  const end = parseISODate(endISO);
  return Math.round((end - start) / 86400000);
}

export function getWeekdayIndex(iso) {
  const day = parseISODate(iso).getDay();
  return day === 0 ? 7 : day;
}

export function startOfWeekISO(iso) {
  const weekday = getWeekdayIndex(iso);
  return addDays(iso, 1 - weekday);
}

export function formatDisplayDate(iso) {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "2-digit",
    month: "short"
  }).format(parseISODate(iso));
}

export function formatRange(startISO, endISO) {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
  return `${formatter.format(parseISODate(startISO))} to ${formatter.format(parseISODate(endISO))}`;
}

export function modulo(number, divisor) {
  return ((number % divisor) + divisor) % divisor;
}

export function getPerson(state, personId) {
  return state.people.find((person) => person.id === personId) || null;
}

export function getPeopleByGroup(state, group) {
  return state.people.filter((person) => person.group === group);
}

export function isOnLeave(state, personId, dateISO) {
  return state.leave.some((leave) => (
    leave.personId === personId &&
    leave.start <= dateISO &&
    leave.end >= dateISO
  ));
}

export function getLeaveForDate(state, dateISO) {
  return state.leave.filter((leave) => leave.start <= dateISO && leave.end >= dateISO);
}

export function getWardPersonId(state, dateISO) {
  if (state.wardOverrides[dateISO]) {
    return state.wardOverrides[dateISO];
  }

  const order = state.settings.wardOrder || [];
  if (!order.length) {
    return null;
  }

  const rotaStart = startOfWeekISO(state.settings.rotaStart);
  const weekStart = startOfWeekISO(dateISO);
  const weekOffset = Math.floor(daysBetween(rotaStart, weekStart) / 7);
  return order[modulo(weekOffset, order.length)];
}

export function getWardCoverage(state, dateISO) {
  const personId = getWardPersonId(state, dateISO);
  const activeIds = personId && !isOnLeave(state, personId, dateISO) ? [personId] : [];
  return {
    date: dateISO,
    type: "ward",
    required: 1,
    assignedIds: personId ? [personId] : [],
    activeIds,
    gap: activeIds.length < 1,
    shortBy: Math.max(0, 1 - activeIds.length)
  };
}

export function getAutoLungConsultants(state, dateISO) {
  const wardPersonId = getWardPersonId(state, dateISO);
  return state.people
    .filter((person) => (
      person.group === "core" &&
      person.rotaPattern === "lung" &&
      person.id !== wardPersonId
    ))
    .map((person) => person.id);
}

export function getClinicSessionsForDate(state, dateISO) {
  const day = getWeekdayIndex(dateISO);

  return state.clinicTemplates
    .filter((template) => template.day === day)
    .map((template) => {
      const autoIds = template.includeLungConsultants ? getAutoLungConsultants(state, dateISO) : [];
      const assignedIds = uniqueIds([...autoIds, ...(template.staffIds || [])]);
      const activeIds = assignedIds.filter((id) => !isOnLeave(state, id, dateISO));
      const required = template.type === "clinic" ? Number(template.required || 0) : 0;

      return {
        ...template,
        date: dateISO,
        autoIds,
        assignedIds,
        activeIds,
        required,
        gap: required > 0 && activeIds.length < required,
        shortBy: Math.max(0, required - activeIds.length)
      };
    })
    .sort((a, b) => {
      const sessionOrder = SESSIONS.indexOf(a.session) - SESSIONS.indexOf(b.session);
      return sessionOrder || a.name.localeCompare(b.name);
    });
}

export function buildWeek(state, weekStartISO) {
  return WEEKDAYS.map((weekday, offset) => {
    const date = addDays(weekStartISO, offset);
    return {
      ...weekday,
      date,
      ward: getWardCoverage(state, date),
      sessions: getClinicSessionsForDate(state, date),
      leave: getLeaveForDate(state, date)
    };
  });
}

export function findGaps(state, startISO, weeks = 1) {
  const gaps = [];
  const rangeStart = startOfWeekISO(startISO);
  const totalDays = weeks * 7;

  for (let offset = 0; offset < totalDays; offset += 1) {
    const date = addDays(rangeStart, offset);
    const weekday = getWeekdayIndex(date);

    if (weekday > 5) {
      continue;
    }

    const ward = getWardCoverage(state, date);
    if (ward.gap) {
      gaps.push({
        id: `ward-${date}`,
        date,
        kind: "ward",
        title: state.settings.wardName,
        location: state.settings.wardName,
        session: "All day",
        required: 1,
        active: ward.activeIds.length,
        shortBy: ward.shortBy,
        assignedIds: ward.assignedIds
      });
    }

    for (const session of getClinicSessionsForDate(state, date)) {
      if (session.gap) {
        gaps.push({
          id: `${session.id}-${date}`,
          date,
          kind: session.type,
          title: session.name,
          location: session.location,
          session: session.session,
          required: session.required,
          active: session.activeIds.length,
          shortBy: session.shortBy,
          assignedIds: session.assignedIds
        });
      }
    }
  }

  return gaps;
}

export function uniqueIds(ids) {
  return [...new Set(ids.filter(Boolean))];
}

export function addLeave(state, leave) {
  const next = clone(state);
  next.leave.push({
    id: leave.id,
    personId: leave.personId,
    start: leave.start,
    end: leave.end,
    reason: leave.reason || "Leave"
  });
  return next;
}

export function removeLeave(state, leaveId) {
  const next = clone(state);
  next.leave = next.leave.filter((leave) => leave.id !== leaveId);
  return next;
}

export function setWardOverride(state, dateISO, personId) {
  const next = clone(state);
  if (!personId) {
    delete next.wardOverrides[dateISO];
  } else {
    next.wardOverrides[dateISO] = personId;
  }
  return next;
}
