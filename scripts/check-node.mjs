// Build-time guard: refuse to build on a Node.js release that predates the
// October 21, 2026 security release (Brotli RCE, TLS hostname bypasses, and the
// eMudhra/emSign CA distrust). Runs before `npm run check` and `npm run build`
// so the Cloudflare and CI logs always show the real Node version.
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

export const minimumByMajor = { 22: '22.23.4', 24: '24.22.1', 26: '26.12.1' };

const parse = version => {
  const match = /^v?(\d+)\.(\d+)\.(\d+)/.exec(String(version));
  return match ? match.slice(1, 4).map(Number) : null;
};

const compare = (a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2];

export function checkNodeVersion(version = process.version) {
  const current = parse(version);
  if (!current) return { ok: false, message: `Unrecognized Node.js version "${version}".` };
  const minimum = minimumByMajor[current[0]];
  const supported = Object.values(minimumByMajor).join(', ');
  if (!minimum) {
    return { ok: false, message: `Node.js ${version} is not a supported release line. Use ${supported} or a newer patch of one of those lines.` };
  }
  if (compare(current, parse(minimum)) < 0) {
    return { ok: false, message: `Node.js ${version} predates the October 21, 2026 security release. Use ${minimum} or newer on the ${current[0]} line (supported: ${supported}).` };
  }
  return { ok: true, message: `Node.js ${version} is patched (minimum ${minimum} on the ${current[0]} line).` };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = checkNodeVersion(process.version);
  console.log(`check-node: ${result.message}`);
  if (!result.ok) {
    console.error('check-node: refusing to build on an unpatched Node.js. Pin 24.22.1 via .nvmrc / NODE_VERSION.');
    process.exit(1);
  }
}
