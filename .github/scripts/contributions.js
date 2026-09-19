// Regenerates the "Open Source Contributions" and "Open Pull Requests" sections
// of README.md from the user's pull requests in repositories they do not own.
// Called by the update-contributions workflow via actions/github-script.
module.exports = async ({ github, core }) => {
  const fs = require('fs');

  const USER = 'gunjanjaswal';
  // Owners treated as "mine" or private client work — skipped. The CI token
  // can't see private repos anyway, but list them so a wider-scoped token can
  // never leak a private client repo onto the public profile.
  const EXCLUDE_OWNERS = new Set([
    'gunjanjaswal',
    'The-Youth-Talks',
    'Abhinav-Immigration-Services-Pvt-Ltd',
  ]);
  // Optional nicer descriptions; falls back to the PR title.
  const OVERRIDES = {
    'home-assistant/core#175180': 'HomeKit thermostat fan-mode casing bug + regression test',
    'santifer/career-ops#1352': 'Follow-up cadence bug fix + test',
    'santifer/career-ops#1442': 'Get on Board zero-auth job provider',
    'PaperMC/Paper#14011': 'Connection-throttle cleanup fix (per-IP anti-DoS)',
    'facebook/docusaurus#12215': 'createExcerpt multi-line JSX leak fix',
  };
  // Nicer display labels per owner; falls back to the owner login.
  const DISPLAY_NAMES = {
    'home-assistant': 'Home Assistant',
    santifer: 'career-ops',
    'career-ops-hq': 'career-ops',
    facebook: 'Meta',
    google: 'Google',
    microsoft: 'Microsoft',
    WordPress: 'WordPress',
    PaperMC: 'PaperMC',
  };
  const displayName = (owner) => DISPLAY_NAMES[owner] || owner;

  // Collect every PR authored by USER matching a search query, following
  // pagination. `when` picks the field used for recency sorting.
  const collect = async (q, whenField) => {
    const items = [];
    for (let page = 1; page <= 10; page++) {
      const res = await github.rest.search.issuesAndPullRequests({
        q,
        // GitHub is migrating the issue/PR search REST API; opt into the new
        // engine so this keeps working after the legacy search is sunset.
        advanced_search: 'true',
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
      const when = Date.parse(it[whenField] || it.updated_at || 0) || 0;
      const g = byOrg.get(owner);
      g.prs.push({ owner, repo, number: it.number, title: it.title, url: it.html_url, when });
      if (when > g.latest) g.latest = when;
    }
    return { count: items.length, orgs: [...byOrg.values()].sort((a, b) => b.latest - a.latest) };
  };

  const esc = (s) =>
    String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

  // One card per org. No nested <table>: long PR titles wrap as plain lines
  // inside the 50%-wide cell, so the section never forces a horizontal scroll.
  const card = (o) => {
    const dn = displayName(o.owner);
    const lines = o.prs
      // Newest first: sort by date, then PR number as a tiebreak so an org's
      // multiple repos interleave by recency rather than by number.
      .sort((a, b) => b.when - a.when || b.number - a.number)
      .map((p) => {
        const desc = OVERRIDES[`${o.owner}/${p.repo}#${p.number}`] || p.title;
        return '        <a href="' + p.url + '">#' + p.number + '</a> ' + esc(desc) + '<br>';
      })
      .join('\n');
    return (
      '    <td align="center" valign="top" width="50%">\n' +
      '      <a href="https://github.com/' +
      o.owner +
      '" title="' +
      esc(dn) +
      '"><img src="https://github.com/' +
      o.owner +
      '.png" width="42" alt="' +
      esc(dn) +
      '"></a>\n' +
      '      <br><b>' +
      esc(dn) +
      '</b><br><br>\n' +
      '      <div align="left">\n' +
      lines +
      '\n      </div>\n' +
      '    </td>'
    );
  };

  // Full section: a heading followed by a 2-column card grid, or an empty note.
  const renderSection = (heading, orgs, emptyText) => {
    if (!orgs.length) return heading + '\n\n' + emptyText;
    const cells = orgs.map(card);
    let rowsHtml = '';
    for (let i = 0; i < cells.length; i += 2) {
      rowsHtml += '  <tr>\n' + cells.slice(i, i + 2).join('\n') + '\n  </tr>\n';
    }
    return heading + '\n\n<div align="center">\n<table width="100%">\n' + rowsHtml + '</table>\n</div>';
  };

  const replaceSection = (readme, name, body) => {
    const START = `<!--START_SECTION:${name}-->`;
    const END = `<!--END_SECTION:${name}-->`;
    const s = readme.indexOf(START);
    const e = readme.indexOf(END);
    if (s === -1 || e === -1) {
      core.setFailed(`${name} markers not found in README.md`);
      return null;
    }
    return readme.slice(0, s + START.length) + '\n' + body + '\n' + readme.slice(e);
  };

  const GH_ICON = '<img src="https://cdn.simpleicons.org/github/8b949e" height="26" align="top" />';

  const merged = await collect(`type:pr is:merged author:${USER}`, 'closed_at');
  const open = await collect(`type:pr is:open author:${USER}`, 'updated_at');

  const mergedSection = renderSection(
    `## ${GH_ICON} Open Source Contributions`,
    merged.orgs,
    '_No merged external contributions yet._'
  );
  const openSection = renderSection(
    `## ${GH_ICON} Open Pull Requests <sub>(awaiting review)</sub>`,
    open.orgs,
    '_No open external pull requests right now._'
  );

  let readme = fs.readFileSync('README.md', 'utf8');
  readme = replaceSection(readme, 'oss-contributions', mergedSection);
  if (readme === null) return;
  readme = replaceSection(readme, 'open-prs', openSection);
  if (readme === null) return;
  fs.writeFileSync('README.md', readme);
  console.log(
    `Rendered ${merged.orgs.length} orgs from ${merged.count} merged PRs, ` +
      `${open.orgs.length} orgs from ${open.count} open PRs.`
  );
};
