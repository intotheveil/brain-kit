#!/usr/bin/env node
// Alias entry point. `brain-kit`, `claude-brain-kit` and `agent-brain-kit` are the SAME tool
// under three names, so it is findable whether you search for the agent, the concept, or the
// kit. All three resolve here, to the one implementation.
//
// kit.mjs reads process.argv itself, so importing it runs it with the arguments the user
// typed — no re-parsing, no second copy of the CLI to drift out of sync.
import 'brain-kit/kit.mjs'
