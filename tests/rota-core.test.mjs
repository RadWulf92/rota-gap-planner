import assert from "node:assert/strict";
import {
  DEFAULT_STATE,
  addLeave,
  buildWeek,
  clone,
  findGaps,
  getAutoLungConsultants,
  getClinicSessionsForDate,
  getWardCoverage,
  getWardPersonId,
  normalizeState,
  setWardOverride
} from "../src/rota-core.mjs";

const state = normalizeState(clone(DEFAULT_STATE));

assert.equal(state.people.find((person) => person.id === "igor").name, "Igor Randulfe");
assert.equal(state.people.find((person) => person.id === "maria").name, "Maria Michaelidou");
assert.equal(state.settings.rotaStart, "2026-05-04");
assert.equal(getWardPersonId(state, "2026-05-04"), null);
assert.equal(getWardCoverage(state, "2026-05-04").required, 0);
assert.deepEqual(getClinicSessionsForDate(state, "2026-05-04"), []);
const openedBankHoliday = normalizeState({
  ...clone(DEFAULT_STATE),
  wardSlotOverrides: { "2026-05-04": { status: "open" } },
  wardOverrides: { "2026-05-04": "igor" }
});
assert.equal(getWardPersonId(openedBankHoliday, "2026-05-04"), "igor");
assert.equal(getWardCoverage(openedBankHoliday, "2026-05-04").required, 1);
const closedWorkday = normalizeState({
  ...clone(DEFAULT_STATE),
  wardSlotOverrides: { "2026-05-05": { status: "closed", label: "Closed" } }
});
assert.equal(getWardPersonId(closedWorkday, "2026-05-05"), null);
assert.equal(getWardCoverage(closedWorkday, "2026-05-05").required, 0);
assert.equal(getWardPersonId(state, "2026-05-05"), "daniel");
assert.equal(getWardPersonId(state, "2026-05-11"), "igor");
assert.equal(getWardPersonId(state, "2026-05-18"), "maria");
assert.equal(getWardPersonId(state, "2026-06-22"), "daniel");
assert.equal(getWardPersonId(state, "2026-08-31"), null);
assert.deepEqual(getAutoLungConsultants(state, "2026-05-11"), ["daniel"]);
assert.deepEqual(getAutoLungConsultants(state, "2026-05-18"), ["igor", "daniel"]);

const week = buildWeek(state, "2026-05-04");
const monday = week[0];
assert.equal(monday.ward.required, 0);
assert.equal(monday.sessions.length, 0);

const withWardLeave = addLeave(state, {
  id: "leave-daniel",
  personId: "daniel",
  start: "2026-05-05",
  end: "2026-05-08",
  reason: "Annual leave"
});
const wardGaps = findGaps(withWardLeave, "2026-05-04", 1).filter((gap) => gap.kind === "ward");
assert.equal(wardGaps.length, 4);

const withCover = setWardOverride(withWardLeave, "2026-05-05", "igor");
const tuesdayGaps = findGaps(withCover, "2026-05-04", 1).filter((gap) => gap.date === "2026-05-05");
assert.equal(tuesdayGaps.some((gap) => gap.kind === "ward"), false);

const stretched = clone(state);
stretched.clinicTemplates = stretched.clinicTemplates.map((clinic) => (
  clinic.id === "wyth-tue-am"
    ? { ...clinic, required: 4, staffIds: ["junior-fellow"] }
    : clinic
));
const clinicGaps = findGaps(stretched, "2026-05-04", 1).filter((gap) => gap.kind === "clinic");
assert.equal(clinicGaps.some((gap) => gap.title === "Wythenshawe clinic"), true);

const migratedState = normalizeState({
  ...clone(DEFAULT_STATE),
  settings: { ...clone(DEFAULT_STATE.settings), rotaStart: "2026-04-27" },
  wardSchedule: undefined
});
assert.equal(migratedState.settings.rotaStart, "2026-05-04");

const removedPersonState = normalizeState({
  ...clone(DEFAULT_STATE),
  people: clone(DEFAULT_STATE.people).filter((person) => person.id !== "acp"),
  clinicTemplates: clone(DEFAULT_STATE.clinicTemplates)
});
assert.equal(removedPersonState.people.some((person) => person.id === "acp"), false);
assert.equal(
  removedPersonState.clinicTemplates.some((clinic) => (clinic.staffIds || []).includes("acp")),
  false
);

console.log("rota-core tests passed");
