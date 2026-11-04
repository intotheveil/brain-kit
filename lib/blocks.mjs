// blocks.mjs — the KIT marker format, shared by kit.mjs (compose/apply/check) and setup.
//
// A block is  <!-- KIT:<KIND>:BEGIN §N -->  ...  <!-- KIT:<KIND>:END §N -->
// parseBlocks returns Map<number, {kind, body}>. Body excludes the markers.

export function parseBlocks(text) {
  const out = new Map();
  // CRLF-SAFE. A Windows checkout with core.autocrlf=true hands this function CRLF text after
  // any git checkout or merge rewrites the file; the marker regex below requires a bare LF right
  // after BEGIN, so every block vanished and `apply` died INCONCLUSIVE ("parsed to zero
  // blocks") — found upstream composing the same repo twice in one day. Normalise before
  // matching; the composed output is LF either way, and git renormalises on commit (CRLF in the
  // worktree is not drift).
  text = text.replace(/\r\n?/g, '\n');
  const re = /<!--\s*KIT:(CORE|PROJECT):BEGIN\s*§(\d+)\s*-->\n([\s\S]*?)<!--\s*KIT:\1:END\s*§\2\s*-->/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    out.set(Number(m[2]), { kind: m[1], body: m[3].replace(/\s+$/, '') });
  }
  return out;
}

/** Render blocks (a Map) as marker-delimited text, in section order. */
export function renderBlocks(blocks) {
  return [...blocks.keys()]
    .sort((a, b) => a - b)
    .map((n) => {
      const b = blocks.get(n);
      return `<!-- KIT:${b.kind}:BEGIN §${n} -->\n${b.body}\n<!-- KIT:${b.kind}:END §${n} -->`;
    })
    .join('\n\n');
}

export const sortedKeys = (m) => [...m.keys()].sort((a, b) => a - b);
