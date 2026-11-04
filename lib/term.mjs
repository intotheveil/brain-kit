// term.mjs — terminal styling with no dependencies.
//
// Colour ONLY when stdout is a TTY and NO_COLOR is unset (https://no-color.org). Escape codes
// piped into a file, a CI log or another program are noise at best and a broken parser at
// worst, and a tool whose output changes shape when redirected is a tool nobody can script.

const enabled = Boolean(process.stdout.isTTY) && !('NO_COLOR' in process.env) && process.env.TERM !== 'dumb';
const wrap = (open, close) => (s) => (enabled ? `\x1b[${open}m${s}\x1b[${close}m` : String(s));

export const c = {
  enabled,
  bold: wrap(1, 22),
  dim: wrap(2, 22),
  red: wrap(31, 39),
  green: wrap(32, 39),
  yellow: wrap(33, 39),
  blue: wrap(34, 39),
  cyan: wrap(36, 39),
  gray: wrap(90, 39),
};
