import MarkdownIt from 'markdown-it';
import GithubSlugger, { slug } from 'github-slugger';
import { formatDate, postSummary, yearOf } from '../../src/utils.ts';

const md = new MarkdownIt({ html: false });
export function markdown(body) {
  const headings = new GithubSlugger();
  const tokens = md.parse(body, {});
  tokens.forEach((token, i) => {
    if (token.type === 'heading_open') token.attrSet('id', headings.slug(tokens[i + 1].content));
  });
  return md.renderer.render(tokens, md.options, {});
}
export { slug };

const entities = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const escape = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => entities[char]);
export const postURL = (post) => '/blog/' + encodeURIComponent(post.slug) + '/';
export const byDate = (a, b) => b.published_at.localeCompare(a.published_at) || a.slug.localeCompare(b.slug);

export function publicPost(post) {
  const summary = postSummary(post.body);
  return {
    ...post,
    categories: post.category ? [post.category] : [],
    excerpt: Array.from(summary).slice(0, 140).join(''),
    summary,
    minutes: Math.max(1, Math.ceil(post.body.trim().length / 400)),
  };
}

// Carry the Astro scope attribute onto markup inserted after the build.
export function replace(selector, render) {
  return [selector, {
    element(element) {
      const scope = Array.from(element.attributes, ([name]) => name)
        .filter((name) => /^data-astro-cid-[a-z0-9]+$/.test(name)).join(' ');
      element.setInnerContent(render(scope ? ' ' + scope : ''), { html: true });
    },
  }];
}

function dateHTML(post, scope, classes) {
  return `<time class="${classes}" datetime="${escape(post.published_at)}"${scope}>${formatDate(new Date(post.published_at))}</time>`;
}

export function recentHTML(posts, s) {
  return posts.slice(0, 7).map((p, i) => `<li class="reveal" style="--d:${i * 0.04}s"${s}>
    <a class="post" href="${postURL(p)}"${s}>
      ${dateHTML(p, s, 'post-date mono-sm')}
      <span class="post-main"${s}><span class="post-title"${s}>${escape(p.title)}</span>
        ${p.summary ? `<span class="post-desc"${s}>${escape(p.summary)}</span>` : ''}
      </span>
      <span class="post-meta"${s}>${escape([p.categories[0], p.minutes && p.minutes + ' min'].filter(Boolean).join(' · '))}</span>
    </a>
  </li>`).join('');
}

export function filtersHTML(posts, s) {
  const counts = new Map();
  for (const post of posts) {
    for (const category of post.categories) counts.set(category, (counts.get(category) ?? 0) + 1);
  }
  const categories = [['', posts.length], ...[...counts].sort((a, b) => b[1] - a[1])];
  return categories.map(([name, count], i) =>
    `<button class="chip filter${i === 0 ? ' on' : ''}" type="button" data-cat="${escape(name)}" aria-pressed="${i === 0}"${s}>${escape(name || '全部')} <span class="count mono-sm"${s}>${count}</span></button>`
  ).join('');
}

export function listHTML(posts, s) {
  const years = Map.groupBy(posts, (post) => yearOf(new Date(post.published_at)));
  return [...years].map(([year, list]) => `<section class="year-group" data-year="${year}"${s}>
    <div class="year mono-sm" aria-hidden="true"${s}>${year}</div><ol${s}>
    ${list.map((p) => `<li class="row-wrap" data-cats="${escape(p.categories.join('|'))}" data-title="${escape(p.title.toLowerCase())}"${s}>
      <a class="row" href="${postURL(p)}"${s}>
        ${dateHTML(p, s, 'mono-sm')}
        <div class="row-main"${s}><span class="row-title"${s}>${escape(p.title)}</span><span class="row-excerpt"${s}>${escape(p.excerpt)}</span></div>
        <div class="row-side"${s}>${p.categories[0] ? `<span class="mono-sm row-cat"${s}>${escape(p.categories[0])}</span>` : ''}
          <span class="mono-sm row-min"${s}>${escape(p.minutes)} min</span></div>
        <span class="row-arr" aria-hidden="true"${s}>→</span>
      </a></li>`).join('')}
    </ol></section>`).join('');
}

export function neighborsHTML(posts, slug, s) {
  const i = posts.findIndex((post) => post.slug === slug);
  if (i < 0) return '';
  return [[posts[i - 1], '较新一篇 ←', ''], [posts[i + 1], '较旧一篇 →', ' right']].map(([post, label, extra]) =>
    post ? `<a class="card nav-card${extra}" href="${postURL(post)}"${s}><span class="mono-sm nav-kicker"${s}>${label}</span><span class="nav-title"${s}>${escape(post.title)}</span></a>` : ''
  ).join('');
}
export { formatDate };
