# ⟡ gatekeeper-truefoundry-hackathon-
An approval-gated dependency upgrade agent. Reads your repo, runs an audit in a sandbox, and asks before opening a PR. Built on TrueForge.

> The agent proposes. A person decides. A second reviewer merges.

<!-- TODO: screenshot of the waiting screen here — it's your strongest image -->

**[⟡ Watch the 3-minute demo →](https://www.youtube.com/watch?v=0qA9fc8ZtvM)**

---

## ⟡ Judge quick path

| Time | What to look at | Why |
|---|---|---|
| 3 min | The demo video | The full loop: audit → sandbox → gate → approval → pull request |
| 1 min | [The gate](#-the-gate) | Where the agent stops, and what a human actually decides |
| 2 min | [Architecture](#-architecture) | How TrueForge reaches GitHub, runs the sandbox, and holds the pause |
| 2 min | [Qodo evidence](#-qodo-code-review-evidence) | A review finding that changed the design |

---

## ⟡ Why

Nobody upgrades dependencies — tedious, no reward, real risk. And you can't tell what's
safe from version numbers alone; something has to actually run. So the job needs an agent
that executes code and writes to your repo, which is exactly the agent you don't want
running unsupervised.

That tension is the whole design.

## ⟡ How it works

```
TURN ONE  read package.json → sandbox → npm audit → classify by risk → STOP
              ↓
          ╔═══════════════════════════════════════╗
          ║  THE GATE — human reviews and decides  ║
          ╚═══════════════════════════════════════╝
              ↓
TURN TWO  branch → commit approved bumps → open PR → STOP
```

The gate isn't a UI animation. It's a real boundary between two agent turns, held open by
TrueForge's `user.tool_approval`. Turn two doesn't begin until a second request arrives
carrying the human's decision.

## ⟡ The gate

- **Risk is visible.** Patch, minor and major are distinct. The major bump — most likely
  to break a build — is emphasised, not hidden.
- **Consent is per package.** Take the security patch, hold back the major.
- **The consequence is stated before you act.** Approving opens a pull request; nothing
  merges without a second human review.
- **What's locked is shown.** Actions waiting on your consent are visible but disabled.
- **Declining is a real outcome** — *held at the gate, nothing opened* — not a dead button.

## ⟡ Architecture

| Layer | Role |
|---|---|
| **TrueForge** | Agent harness — runs the loop, streams events, owns the approval pause |
| **GitHub MCP** | Reads `package.json`, creates the branch, commits, opens the PR |
| **Daytona** | `npm audit` runs in an isolated sandbox, never on the host |
| **Gemini 3.7 Flash** (OpenRouter) | The model — any OpenAI-compatible provider works |
| **Next.js** | The interface; talks to TrueForge server-side, browser never holds keys |
| **Qodo** | Agentic review on every pull request |

```
browser ──► Next.js API routes ──► TrueForge ──► GitHub MCP · Daytona · model
```

<!-- TODO: confirm this matches your repo -->
```
app/api/agent/          run · approve · decline
components/gatekeeper/  use-agent-run.ts · data.ts
lib/trueforge/          client.ts · agent-spec.ts · events.ts
```

## ⟡ The four screens

**Working** — every step as it happens, with real output. **Waiting** — the gate.
**Done** — what applied, what was held back, link to the PR. **Declined** — nothing opened.

<!-- TODO: one screenshot each -->

## ⟡ Running it

Requires Node 18+, a GitHub account, and a model API key.

```bash
npx @truefoundry/trueforge          # harness on localhost:8790
```

In TrueForge: add a model provider, add the GitHub MCP connector (token scoped to `repo`),
and configure Daytona as the sandbox provider.

```bash
git clone https://github.com/naviadepu/gatekeeper-trueforge-hackathon-.git
cd gatekeeper-trueforge-hackathon- && npm install && npm run dev
```

Open `localhost:3000`. The agent reads whichever repo the connected token can reach; the
demo uses the author's own, per the hackathon's guidance. No credentials in this repo —
`.env` is gitignored.

## ⟡ Qodo Code Review Evidence

Every substantive change in this repo went through a branch, a pull request, and a
Qodo review before merge. Nothing was pushed directly to `main`.

**Representative PR:** [#3 — Redesign the UI: full-bleed cyanotype approval flow](https://github.com/naviadepu/gatekeeper-trueforge-hackathon-/pull/3)

Qodo raised two findings on this PR. The High-severity one caught that the Waiting
screen rendered a Reject button with no click handler — the approval-gated flow had
only a working approve path, which undermined the whole point of the gate. Commit
`a16c187` added a real `decline()` handler leading to a distinct `declined` phase and
a `DeclinedScreen` ("held at the gate — nothing opened") so refusing is a real outcome
rather than a dead button. The Medium finding flagged that root metadata still carried
Next.js starter branding; that was also corrected in `a16c187`. Both threads contain my
replies documenting the resolution.

Qodo's high-level assessment additionally endorsed keeping the prototype in one client
page with local state rather than introducing a state-machine library, noting that the
indirection would be premature before the interaction model settled. I agreed and kept
the simpler structure.

<img width="808" height="732" alt="Qodo review findings on PR #3" src="https://github.com/user-attachments/assets/479ce972-cfaa-4741-a21d-a51db3fb62e2" />

**Full PR history:** [all pull requests](https://github.com/naviadepu/gatekeeper-trueforge-hackathon-/pulls)

## ⟡ Next

Per-user GitHub auth for arbitrary repos · run the project's own tests in the sandbox
alongside the audit · persist run history so a team can see what was approved and by whom.

---

Built solo for the WeMakeDevs Agent Harness Hackathon. Developed with AI coding
assistance; every claim about TrueForge, Daytona, GitHub MCP and Qodo describes behaviour
observed in a live run.

MIT
