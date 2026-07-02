# Arcane Consulting (separated module)

This folder contains the **Arcane Consulting** business tooling, which is a
separate product from The Arcane Archives (the trading-education platform).
It was split out of the main app so the Archives no longer links to it or
deploys its serverless functions.

## Contents

| File | Purpose |
| --- | --- |
| `arcane-consulting.html` | Consulting landing / application page |
| `arcane-consulting-crm.html` | Consulting pipeline CRM (leads, payments) |
| `arcane-pipeline.html` | Lightweight sales pipeline board |
| `arcane-cold-call.html` | Cold-call battle-card generator |
| `arcane-lead-agent.html` | Cold-calling / lead engine |
| `functions/consulting-agent.js` | AI proxy for pipeline actions (Anthropic) |
| `functions/lead-agent.js` | AI proxy for lead generation (Anthropic) |

## Deploying separately

These pages call `/.netlify/functions/consulting-agent` (and `lead-agent`).
To run this module on its own Netlify site, point the functions directory at
`consulting/functions` in that site's `netlify.toml`, e.g.:

```toml
[build]
  publish = "consulting"
  functions = "consulting/functions"
```

The Firestore collections it uses (`consulting_leads`, `consulting_payments`,
`consulting_applications`) still have rules in the main `firestore.rules`; keep
those in sync if this module moves to a different Firebase project.

## ⚠️ Known issues to fix before relaunch

These were found during the security audit and are **not yet fixed** (they
require live testing of the AI/CRM flows):

1. **Unauthenticated endpoints.** `functions/consulting-agent.js` and
   `functions/lead-agent.js` accept any POST with no auth. Anyone who knows the
   URL can run up the `ANTHROPIC_API_KEY` bill. Add Firebase ID-token
   verification + an admin check (see `create-store-balance-order.js` in the
   main app for the pattern) and send the token from the calling pages.
2. **Invalid model id.** `consulting-agent.js` requests `claude-sonnet-4-6`,
   which is not a current model — non-cold-call actions will fail. Update to a
   valid Sonnet model id.
