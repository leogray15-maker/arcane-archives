// api/notion.js — Vercel serverless function
// Reads a Notion page (a course or a lesson) and returns:
//   { title, lessons: [{id,title}], html }
// - `lessons` = the page's child pages (used as the lesson list for a course)
// - `html`    = the page's own content rendered to clean HTML for the reader
//
// Requires a Notion internal-integration token in the env var NOTION_TOKEN.
// The integration must be shared with "The Arcane Archives" page in Notion.
//
// Usage:  GET /api/notion?id=<pageId>
//
// Cost: free (Notion API + Vercel Hobby). Responses are cached at the edge.

const NOTION_VERSION = "2022-06-28";

function esc(s = "") {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// Notion rich_text[] -> inline HTML
function renderRich(rich = []) {
  return rich.map(t => {
    let out = esc(t.plain_text || "");
    const a = t.annotations || {};
    if (a.code) out = `<code>${out}</code>`;
    if (a.bold) out = `<strong>${out}</strong>`;
    if (a.italic) out = `<em>${out}</em>`;
    if (a.underline) out = `<u>${out}</u>`;
    if (a.strikethrough) out = `<s>${out}</s>`;
    if (t.href) out = `<a href="${esc(t.href)}" target="_blank" rel="noopener">${out}</a>`;
    return out;
  }).join("");
}

// blocks[] -> HTML (groups consecutive list items)
function renderBlocks(blocks = []) {
  let html = "";
  let listType = null; // 'ul' | 'ol'
  const closeList = () => { if (listType) { html += `</${listType}>`; listType = null; } };

  for (const b of blocks) {
    const type = b.type;
    const d = b[type] || {};
    const rich = d.rich_text || [];

    const isUL = type === "bulleted_list_item" || type === "to_do";
    const isOL = type === "numbered_list_item";
    if (isUL || isOL) {
      const want = isOL ? "ol" : "ul";
      if (listType !== want) { closeList(); html += `<${want}>`; listType = want; }
      if (type === "to_do") {
        html += `<li class="todo${d.checked ? " done" : ""}">${renderRich(rich)}</li>`;
      } else {
        html += `<li>${renderRich(rich)}</li>`;
      }
      continue;
    }
    closeList();

    switch (type) {
      case "heading_1": html += `<h1>${renderRich(rich)}</h1>`; break;
      case "heading_2": html += `<h2>${renderRich(rich)}</h2>`; break;
      case "heading_3": html += `<h3>${renderRich(rich)}</h3>`; break;
      case "paragraph": {
        const inner = renderRich(rich);
        html += inner.trim() ? `<p>${inner}</p>` : "";
        break;
      }
      case "quote": html += `<blockquote>${renderRich(rich)}</blockquote>`; break;
      case "callout": {
        const emoji = d.icon && d.icon.type === "emoji" ? d.icon.emoji + " " : "";
        html += `<div class="callout">${esc(emoji)}${renderRich(rich)}</div>`;
        break;
      }
      case "toggle": html += `<details><summary>${renderRich(rich)}</summary></details>`; break;
      case "code": html += `<pre><code>${esc((rich.map(r => r.plain_text).join("")))}</code></pre>`; break;
      case "divider": html += `<hr>`; break;
      case "image": {
        const url = d.type === "external" ? d.external?.url : d.file?.url;
        if (url) html += `<figure><img src="${esc(url)}" loading="lazy" alt="${esc(renderRich(d.caption || []))}"></figure>`;
        break;
      }
      case "video": {
        const url = d.type === "external" ? d.external?.url : d.file?.url;
        if (url) html += `<p><a href="${esc(url)}" target="_blank" rel="noopener">▶ Watch video</a></p>`;
        break;
      }
      case "bookmark":
      case "embed": {
        const url = d.url;
        if (url) html += `<p><a href="${esc(url)}" target="_blank" rel="noopener">${esc(url)}</a></p>`;
        break;
      }
      case "child_page": /* handled as a lesson, not inline */ break;
      default: break;
    }
  }
  closeList();
  return html;
}

async function notionFetch(path, token) {
  const res = await fetch(`https://api.notion.com/v1${path}`, {
    headers: {
      "Authorization": `Bearer ${token}`,
      "Notion-Version": NOTION_VERSION,
      "Content-Type": "application/json",
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Notion ${res.status}: ${body.slice(0, 200)}`);
  }
  return res.json();
}

async function getAllChildren(id, token) {
  let blocks = [];
  let cursor;
  do {
    const q = cursor ? `?start_cursor=${cursor}&page_size=100` : `?page_size=100`;
    const data = await notionFetch(`/blocks/${id}/children${q}`, token);
    blocks = blocks.concat(data.results || []);
    cursor = data.has_more ? data.next_cursor : null;
  } while (cursor);
  return blocks;
}

function getPageTitle(page) {
  const props = page.properties || {};
  for (const k of Object.keys(props)) {
    if (props[k].type === "title") {
      return (props[k].title || []).map(t => t.plain_text).join("").trim();
    }
  }
  return "Untitled";
}

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  // Accept any of the common env-var names so it works regardless of what it was called
  const token = process.env.NOTION_TOKEN || process.env.NOTION_KEY || process.env.NOTION_API_KEY
             || process.env.NOTION_SECRET || process.env.NOTION_INTEGRATION_TOKEN || process.env.NOTION;
  if (!token) {
    return res.status(503).json({
      error: "not_configured",
      message: "No Notion token found. Set an env var named NOTION_TOKEN (or NOTION_KEY) in Vercel → Settings → Environment Variables (Production), then Redeploy.",
      // Diagnostic: which Notion-related env keys this deployment can actually see
      // (names only, never values). Empty array = the var is NOT in this build.
      presentEnvKeys: Object.keys(process.env).filter(k => /notion/i.test(k))
    });
  }

  const id = (req.query && req.query.id ? String(req.query.id) : "").replace(/-/g, "");
  if (!id) return res.status(400).json({ error: "missing_id" });

  try {
    const [page, blocks] = await Promise.all([
      notionFetch(`/pages/${id}`, token),
      getAllChildren(id, token),
    ]);

    const lessons = blocks
      .filter(b => b.type === "child_page")
      .map(b => ({ id: b.id.replace(/-/g, ""), title: (b.child_page && b.child_page.title || "Untitled").trim() }));

    const html = renderBlocks(blocks);

    // Cache 5 min at the edge, allow stale-while-revalidate
    res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=86400");
    return res.status(200).json({ title: getPageTitle(page), lessons, html });
  } catch (err) {
    return res.status(502).json({ error: "notion_error", message: err.message });
  }
};
