#!/usr/bin/env node
// Alias entry point. This package and `agent-brain-kit` are the SAME tool under two names, so it is
// findable whether you search for the agent or the concept. Both resolve here, to the one
// implementation.
//
// kit.mjs reads process.argv itself, so importing it runs it with the arguments the user
// typed — no re-parsing, and no second copy of the CLI to drift out of sync.
import 'agent-brain-kit/kit.mjs'
