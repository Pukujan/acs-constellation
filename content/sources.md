# Sources — the evidence behind the research section

Every claim below is quoted from a pinned source. Each carries an epistemic tag:
`[MEASURED]` (a number from a cited primary source), `[DERIVED]` (an inference from
measured facts), `[HYPOTHESIS]` (not yet tested), `[VENDOR]` (self-reported by an
interested party).

The site may use **only** what is on this page for its research section. If a claim is
not here, it does not ship. Where a source states its own limit, the limit ships
beside the figure — that is the stack's differentiator, not a caveat to hide.

---

## The survey

`hivemind/research/SURVEY.md` — a survey of **116 systems across 12 clusters** with
roughly **500 cited sources**. It is a research corpus, not a product. Its findings are
the ammunition for the research section.

### Finding: epistemic status is almost never a stored field

`[MEASURED]` Across about **73 systems**, only a small minority store a truth-status
vocabulary on the item itself.

> "The field is *evaluated as output behavior everywhere and stored as item state
> almost nowhere*."

The exceptions the survey found, by cluster:

- PKM / markdown-land: OKF v0.2 (`status: draft|stable|deprecated`), swarmvault
  (`extracted|inferred|ambiguous`), obsidian-mind (`verified|inferred|unverified`),
  Epistract (7 certainty labels), agentcairn (`valid_from`/`valid_until`/
  `superseded_by`).
- Hosted / OSS products: Supermemory (`isInference`/`isLatest`/`isForgotten`/
  `isStatic`), Hindsight (`fact_type`, `state: valid|invalidated`), Mem0 Platform
  (`synthesized`, `replaced_by`).
- Foundations: Wikidata ranks, RDF 1.2 reifiers, TMS IN/OUT, Self-RAG (`IsSup`),
  CRAG (`Correct|Incorrect|Ambiguous`).

Everything else — Mem0 OSS, Letta, Cognee, Mem0 (shipped), MemGPT, A-MEM, MemoryBank,
HippoRAG, Obsidian, Logseq, Tana, ChatGPT, Claude, Cursor, NotebookLM, Basic Memory,
Khoj, the MCP reference server — has **no status field**; at most a free-form tag.

### Finding: nothing propagates invalidation through derived-from chains

`[MEASURED]` The survey calls this the single most consistent gap.

Systems that *do* record lineage (PROV-O's `wasDerivedFrom`, PAM's `parent_ids`,
Kumiho's `Derived_From`/`Depends_On`, Supermemory's `DERIVES` edge, Hindsight's
source-facts) use it for **audit and display, not maintenance** — invalidating a
parent does not flip a child.

`[MEASURED]` The 2026 STALE benchmark names the failure explicitly: "propagated
conflicts" where an update cascades through "latent attributes" that "are never
explicitly stated", and **the best model reaches only 55.2%**.

Source: STALE, arXiv 2605.06527.

### Finding: contradiction handling splits into four incompatible regimes

`[MEASURED]` No two clusters agree on what to do when a new fact contradicts an old one:

1. **Overwrite (last-write-wins)** — Letta/MemGPT blocks are "blindly overwritten";
   A-MEM overwrites; the MCP reference server overwrites; ChatGPT/Claude/Cursor are
   manual-edit overwrite.
2. **Invalidate-not-delete** — Zep/Graphiti keeps the old edge and sets `invalid_at`;
   Hindsight sets `state: invalidated`; Supermemory uses `isLatest`/`version` plus
   soft-delete.
3. **Add-only (no reconciliation)** — Mem0 v3 is the documented regression: the
   migration removed UPDATE/DELETE from the OSS write path (about **4,000 lines
   cut**), so conflicting facts accumulate.
4. **Manual** — ChatGPT ("Don't mention this again"), Claude, Cursor, and Mem0
   Platform all rely on the user to edit or delete.

Source: `hivemind/research/SURVEY.md` §2.2, citing `docs.mem0.ai/migration/oss-v2-to-v3`.

### Finding: the write path is where memory fails

`[MEASURED]` **69.0%** of memory failures are write-time omissions.

Source: An 2026, arXiv 2601.00821.

`[MEASURED]` Extraction loses **15.9 points** on LoCoMo and **22.0 points** on
LongMemEval-S versus verbatim storage.

Source: An 2026, arXiv 2601.00821.

`[MEASURED]` Memory **update** accuracy is **below 50%** in every system tested:
Mem0 25.5%, Mem0-Graph 24.5%, Memobase 5.2%, Supermemory 16.4%, Zep 47.3%; omission
rates 52–94%.

Source: HaluMem, arXiv 2511.03506.

`[MEASURED]` At 1M-token histories, correct updates collapse to **1.5–37%**, and
omission rises to 62–98%.

Source: HaluMem, arXiv 2511.03506.

`[MEASURED]` Memory errors **accumulate** through the pipeline:

> "Hallucinations accumulate during the extraction and updating stages, which
> subsequently propagate errors to the question answering stage."

Source: HaluMem, arXiv 2511.03506.

### Finding: adding memory can make agreement worse

`[MEASURED]` Memory amplifies sycophancy **up to 40%** over in-context baselines,
across Mem0, MemOS and Zep, in 5 model families. Sonnet 4.6: **1.6%** sycophancy with
chat history rising to **40.2%** under Mem0. The authors name **memory extraction**
"the primary culprit" and call it "a systemic property of the memory layer".

Source: arXiv 2606.10949.

### Finding: visibility does not imply authority

`[MEASURED]` Agents cannot detect **implicit** memory staleness. The best model reaches
**55.2%**. The survey's summary of the finding:

> "visibility does not imply authority" — new evidence is retrieved but not treated as
> authoritative.

Source: STALE, arXiv 2605.06527.

### Finding: the gap analysis

`[DERIVED]` The survey maps 11 requirements to the closest prior art and names what no
surveyed system ships. The four sharpest:

| Requirement | Closest prior art | What no surveyed system ships |
|---|---|---|
| First-class epistemic state | OKF v0.2, Supermemory, Hindsight, TMS IN/OUT | A single status enum that is a first-class stored field, **is read by retrieval**, and covers the full set. Every prior-art enum is partial, uses different labels, and is often "written but never read". |
| Decisions first-class, never reified into facts | rand/mnemosyne `Decision` type, OKF `decision`, ADR/MADR | Any shipped agent-memory system where decisions are a distinct type that survives revocation with its rationale. The memory products collapse decisions into facts. |
| Lineage / provenance, PROV-O-style | PROV-O, PAM `parent_ids`, Supermemory `DERIVES` | A system that uses lineage for **maintenance**, not just audit. |
| Supersession propagates to derived items | TMS, probabilistic-DB lineage, event sourcing | **Any shipped system.** This is the universal gap. |

`[DERIVED]` The survey's net read: of the four requirements targeting stored epistemic
state, **propagation is the one with essentially zero shipped prior art** — the field
records lineage but never acts on it.

---

## What each component answers

The mapping the site draws. Each row is one component, the failure it answers, and the
source sentence.

| Component | Answers | Source sentence |
|---|---|---|
| **PCM** | Context lost between sessions; the same background rewritten; unverifiable claims about past work | "Long-running AI-assisted projects accumulate context across many sessions and agents. Relying on a single conversation creates context rot, hidden state, poor handoffs, duplicated work, and unverifiable claims about what previous agents did." — `project-continuity-modules/PROJECT.md:11` |
| **OIO** | An observation with no authority; no single set of definitions; the installer grading itself | "Every issue carries a required, machine-checkable filer stamp. It answers two questions: who initiated this filing, and whose identity is on it." — `observational-issue-ops/PROJECT.md:44` |
| **ACS** | Two agents duplicating work; agents acting on stale state; disagreement with no tie-breaker | "Agents are cheap to run and expensive to coordinate. Without a shared, versioned install surface, two agents on one repository duplicate work, act on stale state, or disagree with no tie-breaker." — `agent-custom-setup/PROJECT.md:32` |
| **train** | A version pin hand-copied across files; a repository certifying its own siblings | "Measured 2026-10-01: one pin lived in thirteen files across three revisions." — `agent-stack-train/PROJECT.md:9` |
| **CGM** | Technical completeness without understanding; confident copy nobody checked | "An agent sees a folder tree, produces confident copy, adds a generic hero, and moves on before checking whether the result tells a human why the project exists." — `content-generation-modules/PROJECT.md:10` |

### The ownership rule each component states

Every one of the five repositories carries the same sentence about itself: it owns
exactly one layer and does not own the others. Two examples:

- `agent-stack-train/PROJECT.md:38` — "No product repository certifies its own
  siblings."
- `observational-issue-ops/PROJECT.md:69` — "OIO exists separately because the issue log
  used to live *inside* the installer. When ACS owned both the installer and the
  coordination rules, installing ACS installed governance — the installer was grading
  itself."

---

## What the site must not say

- No invented figure, product name, acronym expansion, or release date.
- No "trusted by", no customer logos, no visitor or star counts.
- No `.hotload/` directory tree and no Octo database — neither is part of this build.
- Do not describe how any image was generated.
- Do not present a hypothesis as a measured result, or a plan as a shipped feature.
