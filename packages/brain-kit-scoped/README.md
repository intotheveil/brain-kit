# @alexadamis/brain-kit

**This is an alias package.** It installs and runs
[`agent-brain-kit`](https://www.npmjs.com/package/agent-brain-kit) — same tool, same version.

```bash
npx @alexadamis/brain-kit init  myrepo
npx @alexadamis/brain-kit apply myrepo
```

It exists because the unscoped name `brain-kit` is refused by npm's name-similarity guard: an
abandoned `brainkit@0.0.0` already holds that neighbourhood. Scoped names are exempt, so this is
how the original name stays reachable.

Full documentation: **https://github.com/intotheveil/brain-kit**

MIT.
