#!/usr/bin/env node
// One line per gate, appended to .gate-report.jsonl as the build runs.
//
// The change requests for this site ask for gate output to be recorded as evidence, not
// asserted. The build runs these gates as a chain, so their standard output is not
// available to whoever assembles the record afterwards. Writing the same sentence to a
// file costs nothing and leaves the proof behind: read the file and you have what each
// gate measured, in its own words, from the run that passed.
//
// A gate that fails exits before it gets here, so a line in the report means a line from
// a passing gate.

import { appendFileSync, writeFileSync } from "node:fs";

const FILE = ".gate-report.jsonl";

/** Starts a fresh report. The first gate in the chain calls this. */
export function resetGateReport() {
  writeFileSync(FILE, "");
}

/** Appends one gate's summary line. */
export function recordGate(name, summary) {
  appendFileSync(FILE, `${JSON.stringify({ name, summary })}\n`);
}
