// Regenerates the "Open Source Contributions" section of README.md from the
// user's merged pull requests in repositories they do not own. Called by the
// update-contributions workflow via actions/github-script.
module.exports = async ({ github, core }) => {
  const fs = require('fs');

  const USER = 'gunjanjaswal';
  // Owners treated as "mine" — skipped (not outside contributions).
  const EXCLUDE_OWNERS = new Set(['gunjanjaswal', 'The-Youth-Talks']);
  // Optional nicer descriptions; falls back to the PR title.
  const OVERRIDES = {
    'home-assistant/core#175180': 'HomeKit thermostat fan-mode casing bug + regression test',
    'santifer/career-ops#1352': 'Follow-up cadence bug fix + test',
  };

  // Collect all merged PRs authored by USER.
  const items = [];
  for (let page = 1; page <= 10; page++) {
    const res = await github.rest.search.issuesAndPullRequests({
      q: `type:pr is:merged author:${USER}`,
      per_page: 100,
      page,
    });
    items.push(...res.data.items);
    if (res.data.items.length < 100) break;
  }

  // Group by owner (org), external only.
  const byOrg = new Map();
  for (const it of items) {
    const m = /repos\/([^/]+)\/([^/]+)$/.exec(it.repository_url || '');
    if (!m) continue;
    const owner = m[1];
    const repo = m[2];
    if (EXCLUDE_OWNERS.has(owner)) continue;
    if (!byOrg.has(owner)) byOrg.set(owner, { owner, prs: [], latest: 0 });
    const when = Date.parse(it.closed_at || it.updated_at || 0) || 0;
    const g = byOrg.get(owner);
    g.prs.push({ repo, number: it.number, title: it.title, url: it.html_url });
    if (when > g.latest) g.latest = when;
  }

  const esc = (s) =>
    String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

  const orgs = [...byOrg.values()].sort((a, b) => b.latest - a.latest);

  const card = (o) => {
    const rows = o.prs
      .sort((a, b) => a.number - b.number)
      .map((p) => {
        const desc = OVERRIDES[`${o.owner}/${p.repo}#${p.number}`] || p.title;
        return (
          '        <tr><td align="left">' +
          esc(desc) +
          '</td><td align="center"><a href="' +
          p.url +
          '">#' +
          p.number +
          '</a></td></tr>'
        );
      })
      .join('\n');
    return (
      '    <td align="center" valign="top" width="50%">\n' +
      '      <a href="https://github.com/' +
      o.owner +
      '" title="' +
      esc(o.owner) +
      '"><img src="https://github.com/' +
      o.owner +
      '.png" width="48" alt="' +
      esc(o.owner) +
      '"></a>\n' +
      '      <table>\n' +
      '        <tr><th align="left">' +
      esc(o.owner) +
      '</th><th>PR</th></tr>\n' +
      rows +
      '\n      </table>\n' +
      '    </td>'
    );
  };

  const cells = orgs.map(card);
  let rowsHtml = '';
  for (let i = 0; i < cells.length; i += 2) {
    rowsHtml += '  <tr>\n' + cells.slice(i, i + 2).join('\n') + '\n  </tr>\n';
  }

  const section = orgs.length
    ? '## 🤝 Open Source Contributions\n\n<div align="center">\n<table>\n' + rowsHtml + '</table>\n</div>'
    : '## 🤝 Open Source Contributions\n\n_No merged external contributions yet._';

  const START = '<!--START_SECTION:oss-contributions-->';
  const END = '<!--END_SECTION:oss-contributions-->';
  let readme = fs.readFileSync('README.md', 'utf8');
  const s = readme.indexOf(START);
  const e = readme.indexOf(END);
  if (s === -1 || e === -1) {
    core.setFailed('oss-contributions markers not found in README.md');
    return;
  }
  readme = readme.slice(0, s + START.length) + '\n' + section + '\n' + readme.slice(e);
  fs.writeFileSync('README.md', readme);
  console.log('Rendered ' + orgs.length + ' orgs from ' + items.length + ' merged PRs.');
};
