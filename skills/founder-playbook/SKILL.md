---
name: founder-playbook
description: Stress-test a startup idea, product, or company against Anthropic's Founder's Playbook — detect which of the four stages (Ideate, MVP, Launch, Scale) the work is actually in, grill the assumptions that stage is supposed to have cleared against live social and SEO evidence rather than recall, and hand back a written risk report plus a next-step checklist. Use when asked to pressure-test or stress-test an idea, validate a problem, check problem-solution fit, size a market, sanity-check PMF signal, audit growth economics or founder bottlenecks, or articulate a moat. Triggers on "stress test this idea", "poke holes in this", "is this worth building", "do I have PMF", "am I ready to launch/scale", "what's my moat", "founder playbook".
---

# Founder Playbook

Someone describes an idea, a product, or a company in plain language. You figure
out **which stage they're actually in**, then attack the assumptions that stage
is supposed to have cleared — and end with a written report they can act on.

**The rule that makes this skill worth invoking:** you are not here to help them
feel good about the idea. Asked to validate, an AI will find supporting evidence;
that is the exact failure the playbook warns about. Your job is the adversarial
pass — the segments that won't convert, the substitutes users already tolerate,
the competitor who wins. If the idea survives *you*, it earned it.

Full source: `reference/founder-playbook.md`. Read it when you need the verbatim
framing for a stage; the per-stage kits below are the working summary.

## 1. Detect the stage

Four stages, each with a different question. Pick by **evidence they describe**,
not by what they call themselves — founders routinely claim a later stage than
their evidence supports, and that mislabel is itself the finding.

| Stage | Question it answers | Signals you're here |
|---|---|---|
| **Ideate** | Is this worth building? | Idea/hypothesis, no users, or users only imagined. Talk of "I think people would…" |
| **MVP** | Does the product deserve to exist? | Something shipped, real users, arguing about traction and retention |
| **Launch** | Does the business deserve to grow? | PMF signal held up; now acquisition, infra, ops, hiring |
| **Scale** | Is the growth systematic and defensible? | Many markets, enterprise/investor audiences, moat and governance questions |

Rules:

- **User states a stage → take it**, but verify against the exit criteria of the
  stage *before* it. If a prior gate is unmet, say so in the report — that's a
  premature-scaling finding, the playbook's central warning.
- **Ambiguous → assume the earlier stage** and say why. Cost of grilling a
  cleared assumption is a paragraph; cost of skipping an uncleared one is the
  company.
- **Idea spans stages** (common: shipped product, but the problem was never
  validated) → grill the earliest unmet stage first, note the others.
- Announce the detected stage and the evidence for it in one line before you
  start. Don't ask permission.

## 2. Grill the stage

Work the stage kit below. Depth over breadth: **three assumptions genuinely
broken beats twelve questions asked**. For each, press until it's a testable
claim (who, how often, how severe, how to test it) or an admitted unknown.
Not this: "People struggle with expense reporting." This: "Finance managers at
mid-market companies spend 4+ hours a week reconciling submissions because their
tools don't integrate with their accounting software."

If a question is already answered in what they gave you, don't re-ask it —
verify the answer and move on. Ask clarifying questions inline only when an
answer changes the whole line of attack; otherwise carry the ambiguity into the
report as a named unknown.

### Ideate kit — is this worth building?

- **Problem reality.** Who exactly has it? How often, how severely? What do they
  do about it *today* — and why is that tolerable enough that they still do it?
- **Solution fit.** Does the idea address the problem validation revealed, or the
  one originally assumed? Name the drift when they differ.
- **Disconfirming evidence.** Argue the strongest case the idea fails: negative
  market signals, failed predecessors doing roughly this, structural obstacles.
- **Competitors, four tiers** — direct (same problem, same way), indirect (same
  problem, different way), potential acquirers, adjacent players with
  distribution. Argue why each is a *genuine* threat, not the dismissible
  version. An adjacent player with distribution beats a direct competitor with
  feature parity.
- **Market sizing.** TAM / SAM / SOM — pressure-test the assumptions under the
  numbers, not the totals. Expanding, consolidating, or mature?
- **Interview honesty.** If they've talked to users: past behavior or
  hypothetical intent? One interview is an anecdote. Force two lists — evidence
  supporting the hypothesis, evidence challenging it.

Exit gate — all three must be yes: problem is real and specific; solution
addresses the *validated* problem; signal is enough that committing to an MVP is
a reasoned decision, not faith. Certainty never arrives here; waiting for it is
its own failure mode.

### MVP kit — does the product deserve to exist?

- **Metrics chosen in advance?** If not, traction is being graded on a
  flattering curve after the fact.
- **PMF false positives.** Signups without activation, revenue without
  retention, launch enthusiasm without repeat usage. Sean Ellis test: >40% of
  active users "very disappointed" to lose it — dependence, not approval. Effort
  test: does the product pull users back, or does the founder?
- **The four traps.** Agentic technical debt (each session re-derives decisions,
  they drift, no coherent mental model); false PMF; zero-friction scope creep;
  insecure generated code. Acceptable debt is known and bounded — silent
  structural debt is the time bomb.
- **Scope document.** Does it say what the product deliberately *doesn't* do, and
  what evidence justifies adding? Bad: "several users said it'd be nice." Good:
  "a critical mass of target users can't get value without it."
- **No PMF?** Is a segment responding differently? Positioning problem or product
  problem? What would have to be true for this product to find fit — and is that
  realistic? Then: adjust, pivot, or revalidate.

### Launch kit — does the business deserve to grow?

- **Production vs demo.** Does it keep working when traffic, edge cases, and
  adversarial inputs arrive at once? Production-readiness is a moving target.
- **Architectural audit.** Prioritized map — structural weakness, test-coverage
  gaps, refactor candidates ranked by risk. Brittleness in a corner that never
  changes can wait; brittleness on the critical path threatens every feature.
- **Repeatable channel.** Can they describe how new users arrive and what it
  costs? CAC, LTV, payback period. CAC > LTV → move on from the channel. One
  lucky headline is not a channel.
- **Founder bottleneck.** Decisions waiting a week for the founder, support only
  the founder can answer, tasks that happen only when the founder remembers.
  Audit the recurring load, sort into: automate entirely / needs a human but not
  the founder / genuinely needs founder judgment.
- **Recurring processes** that run without the founder triggering them: sprint
  cadence, minimum spec template, bug triage decision tree, weekly metrics brief
  off real data sources.

### Scale kit — is growth systematic and defensible?

- **Systematic vs felt growth.** Founder instinct doesn't reach across many
  markets and millions of users. Is the engine a system, and is that system
  sound?
- **Moat, three compounding sources** — expertise encoded in the product, depth
  of integration with tools users rely on, proprietary data and workflows
  accumulated in use. The test: if a well-funded incumbent copied the product
  today, would users stay?
- **Moat narrative.** One page: how the flywheel spins, how long it's been
  spinning, why a well-resourced competitor starting today couldn't replicate it
  in a couple of years. A moat the founder can't explain is one outsiders won't
  credit.
- **GTM engine.** Segmentation, messaging architecture, analyst relations, sales
  playbooks, investor-facing metrics narrative. Each audience has its own
  vocabulary.
- **Governance, compliance, financial controls.** Growth has to be auditable —
  profitability, IPO-readiness, and acquisition all demand it.

## 3. Go get evidence

The playbook's whole warning is that an AI asked to validate will assemble a
well-researched-looking case for a bad idea. Recalled market facts are the
material that case gets built from. So:

**Inadmissible from memory.** These claims never pass the grill on recall alone —
pull them or stamp them `UNVERIFIED` in the report:

- anyone has this problem (vs. you assume they do)
- how big a competitor is, or which tier they're really in
- the market exists / is growing / is mature
- a channel works, and what it costs
- users would stay if a copy shipped tomorrow

Two sibling skills do the pulling. Read their `SKILL.md` and run their scripts
from their own directories:

- **`social-search`** — `scripts/socialcrawl.ts` (Reddit, LinkedIn, YouTube,
  TikTok, IG, Threads…), `scripts/socialdata.ts` (X). Unprompted human speech.
- **`dataforseo`** — `scripts/dataforseo.ts` — `traffic` (organic visits +
  ranking keywords, up to 1,000 domains **in one call**), `keywords` (volume,
  difficulty, CPC).

> **Spend discipline.** `dataforseo balance` is free — run it first. The balance
> is small and the minimum top-up is $50, so if it won't cover the call, say so
> and continue on social data alone with the numbers marked `UNVERIFIED`. Never
> loop the script over a list; pass the whole list as arguments. One batched call
> answers the same question as twenty single ones.

**vs. the `cmo` skill:** `cmo` produces a full market brief. Use it when the
market question is wide open. Here you usually want one narrow answer to break
one assumption — go direct to the scripts. Hand off to `cmo` when the grill
finds the *entire* market premise unexamined.

### What to pull, per stage

**Ideate**

- *Problem reality* → search Reddit/X for people describing the problem
  **unprompted, in their own words**. This is the past-behavior test at scale: a
  complaint thread is behavior, a survey answer is intent. Harvest what they say
  they currently do — those are the substitutes they already tolerate.
- *Disconfirming evidence* → search for the people who tried and quit ("we built
  this", "we switched back to spreadsheets"). Then `traffic` on predecessor
  domains: collapsing organic traffic is a company that ran this experiment for
  you and lost.
- *Competitor tiers* → one `traffic` call with **every** domain across all four
  tiers. The adjacent player with 40× your direct competitor's traffic is the
  threat you were about to under-rate.
- *TAM/SAM/SOM* → `keywords` on the problem's vocabulary as a bottom-up demand
  check. It won't give you TAM, it pressure-tests the assumption under it. Zero
  search volume on the language your users supposedly use is a finding. Volume
  concentrated in few domains = consolidating; long tail = fragmented.

**MVP**

- *Launch-ephemeral vs. real* → search your own product name over time. Did the
  conversation continue past launch week, or flatline?
- *Segment divergence* → who is actually posting about you, and are they the
  segment you designed for?

**Launch**

- *Repeatable channel* → `keywords` gives volume × difficulty × CPC. CPC is a
  direct read on paid cost; difficulty on organic time-to-payback. Feed both
  into the CAC/LTV question instead of guessing.
- *Where the audience already is* → social search across platforms before
  committing spend to one.

**Scale**

- *Moat test* → search for switching and migration threads in your category. If
  users publicly move between tools with a shrug, the lock-in isn't there.
- *Moat narrative* → competitor `traffic` trajectory is the "how long has the
  flywheel been spinning" evidence, in a form investors already accept.

Pull only what changes a verdict. Two calls that break an assumption beat ten
that decorate the report.

## 4. Report

End every run with this, written out in the response. Don't offer to write it —
write it.

1. **Stage** — detected stage, the evidence, and any earlier gate still open.
2. **Sharpened hypothesis** — their idea restated as a testable claim. Ideate
   stage especially: this is often the single most useful artifact of the run.
3. **Top 3 risks** — ranked by what kills the thing soonest. Each: the
   assumption, why it's shaky, what would disconfirm it. Tag every factual claim
   `[pulled]` (evidence fetched this session, cite the post or the number),
   `[claimed]` (the user asserted it), or `[unverified]` (nobody checked). A
   report where the load-bearing claims are all `[claimed]` says so at the top.
4. **What would have to be true** — the conditions under which the idea works,
   stated plainly enough to be checked.
5. **Next validation step** — the cheapest evidence that moves the biggest risk.
   Concrete: who to talk to, what to measure, what to look for.
6. **Checklist** — the stage's exit criteria as checkboxes, marked met / unmet /
   unknown.

Keep unknowns labelled as unknowns. A confident-sounding brief over thin
evidence is the failure mode this whole skill exists to prevent.

Don't write files unless asked. The user will ask separately for a markdown
export; when they do, the report above is what goes in it.

## Notes

- **Building is not validating.** A working prototype proves it can be built, not
  that anyone needs it. Its real value is as a prop for user conversations.
- **Premature scaling** — committing to a path before validating the path is
  worth committing to — is the failure this playbook is organized around. Flag it
  whenever a stage's evidence outruns the prior stage's gate.
- The constraint is no longer engineering capacity. It's clarity about what
  deserves to exist.
