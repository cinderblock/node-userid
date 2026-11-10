// Refuse to publish from anywhere but CI. Releases go through `.github/workflows/release.yml`,
// which publishes with provenance from a clean checkout.
//
// The one exception is a `0.0.0` placeholder, used only to claim a brand-new package name.

const { version } = require('../package.json');

if (process.env.GITHUB_ACTIONS === 'true' && process.env.CI === 'true') process.exit(0);
if (version === '0.0.0') process.exit(0);

console.error(`Refusing to publish userid@${version} outside CI.`);
console.error('Push a version tag (e.g. `git tag v' + version + ' && git push origin v' + version + '`) instead.');
process.exit(1);
