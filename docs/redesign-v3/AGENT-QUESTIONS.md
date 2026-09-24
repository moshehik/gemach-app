# AGENT-QUESTIONS — open questions + choices made autonomously

Format per entry: question → choice made (and why) → where it's used → whether it's blocking.
This run never stops to ask a live human (scheduled/autonomous task) — every ambiguity below was resolved by picking the safest option consistent with CONSTITUTION.md/DECISIONS.md/MASTER-PLAN.md, and logged here for the owner to revisit.

---

## Q-1: Does LayerManager get composed into `app/layout.js` in this phase?
MASTER-PLAN.md Phase 1.3 says LayerManager is "מורכב ב-layout.js (כולל מסך כניסה)" (composed in layout.js, including the login screen). But the scheduled task's own scope (section C, which is the specific assignment for this run) explicitly says: *"Do NOT rewire existing pages yet (the compatibility shim is a later phase) — build the primitives and prove them in the gallery."* `app/layout.js` is the live, shared root layout for the entire running app (both orgs, every page) — mounting a new global portal/provider there is exactly the kind of change that needs a human to watch it in a real browser against a real DB, which this environment cannot do (no secrets, no DB). Wiring it blind, unreviewed, into the one file every page depends on is a much bigger blast radius than anything else in scope.
**Choice:** did NOT touch `app/layout.js`. Built `LayerManager` + `LayersProvider` as a self-contained module that the gallery route (`app/v3-gallery/page.js`/`Gallery.js`) mounts locally to demonstrate every primitive. `app/layout.js` composition is left for a later, human-supervised phase (matches the master-plan phasing where Phase 1 build happens "together with the pilot page" and Phase 3 step 5 is explicitly local/supervised integration).
**Not blocking** — the library is fully usable via `import { LayersProvider, useLayers } from '@/app/v3/overlays'`; whoever wires `layout.js` next just adds the provider once at the root.

## Q-2: Topbar comparison (Part A) — no code change needed?
Diagnosis 01 §3.1 already found the real `.v3-topbar` CSS values (`components.css:1005-1092`) match the sketch's `.snav` CSS almost byte-for-byte (same heights, paddings, tab sizing) — the "looks smaller/cramped" symptom was entirely explained by F1 (button font/color reset) and F3 (Assistant !important). Both are fixed in this run (see WORKLOG). No topbar layout/typography values were changed.
**Choice:** left `components.css`'s topbar block untouched; only removed the two bugs that were making it *render* wrong. The 7 extra controls the diagnosis flagged (pins, back/forward/refresh, theme toggle, message history, error report) are outside `app/v3/**` (they live in `AppShell.js`/`app/components/*`, not in scope for this run) — logged here rather than silently touched.
**Not blocking.**

## Q-3: `app/design-overrides.css` Assistant/Frank-Ruhl !important override (F3)
This file is global (loaded for the whole app, not just v3 pages) and explicitly documents itself as a deliberate `!important` hammer for legacy inline styles. Editing its rules in place risks the many non-v3 pages that still rely on it. Rather than weaken it globally, added a narrow, scoped counter-rule (also `!important`, since only `!important` can beat `!important` outside of `@layer`, and this file predates `@layer` adoption) that re-asserts Rubik specifically inside `[data-v3]` — i.e. it only ever fires on pages already opted into v3, never on legacy pages.
**Choice:** new rule lives in `app/v3/tokens/base.css`, imported by `V3Page`, scoped to `:where([data-v3], [data-v3] *)`. Did not touch `app/design-overrides.css` itself.
**Not blocking.**

## Q-4: `legacy-bridge.css` built but not wired in
LIBRARY-MAP §2 lists a bridge from old CSS variable names (`--primary-color`, `--bg-color`, `--text-main`...) to the new L1 tokens, so legacy shared components (RentalReturnModal, PopupProvider, date pickers, StatisticsModal, ...) that get rendered inside an already-converted v3 page pick up navy/sky/gold instead of the old wine/cream palette. Built it at `app/v3/tokens/legacy-bridge.css`, correctly mapped, but **did not import it from `V3Page.js`**.
**Why:** importing it would immediately, silently recolor every legacy component nested inside every one of the 25 pages that already use `V3Page` — a real, broad, live-rendering change across the production app that I cannot verify in a browser this run (no DB/dev-server). That is a bigger blast radius than "the surgical fixes in A" the scope authorized, and the master-plan itself treats this bridge as scaffolding to be removed "only with user approval" (§ה.3/Phase 5ג) — implying its activation, not just its removal, deserves a look.
**Choice:** the file exists, documented, ready to `@import` from `V3Page.js` (or `tokens.css`) in one line whenever someone reviews it visually and turns it on.
**Not blocking** — nothing currently imports it, so it has zero effect today.

