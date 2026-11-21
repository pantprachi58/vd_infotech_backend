/**
 * Article bodies are stored as plain blocks, never raw HTML — the same shape
 * the website renders (see frontend/src/components/blog/BlogContent.js):
 *
 *   { type: "p" | "h2" | "h3" | "h4" | "quote", runs: Run[] }
 *   { type: "ul" | "ol",              items: Run[][] }
 *   { type: "hr" }
 *
 *   Run = { br: true }               // line break
 *       | { text: string, bold?: true,
 *           href?: string,            // external link
 *           post?: string }           // link to another post, by slug
 */
const TEXT_TYPES = new Set(["p", "h2", "h3", "h4", "quote"]);
const LIST_TYPES = new Set(["ul", "ol"]);
const ALLOWED_TYPES = [...TEXT_TYPES, ...LIST_TYPES, "hr"];

function cleanRun(run, where) {
  if (!run || typeof run !== "object") throw new Error(`${where}: each run must be an object`);
  if (run.br) return { br: true };
  if (typeof run.text !== "string") throw new Error(`${where}: run.text must be a string`);
  const out = { text: run.text };
  if (run.bold) out.bold = true;
  if (typeof run.post === "string" && run.post) out.post = run.post;
  else if (typeof run.href === "string" && /^(https?:\/\/|\/|mailto:|tel:)/.test(run.href)) out.href = run.href;
  return out;
}

function cleanRuns(runs, where) {
  if (!Array.isArray(runs)) throw new Error(`${where}: runs must be an array`);
  return runs.map((r, i) => cleanRun(r, `${where}.runs[${i}]`));
}

/** Validates and normalises a body; throws an Error with a readable path on bad input. */
export function normaliseBlocks(blocks) {
  if (blocks == null) return [];
  if (!Array.isArray(blocks)) throw new Error("blocks must be an array");

  return blocks.map((block, i) => {
    const where = `blocks[${i}]`;
    if (!block || !ALLOWED_TYPES.includes(block.type)) {
      throw new Error(`${where}: type must be one of ${ALLOWED_TYPES.join(", ")}`);
    }
    if (block.type === "hr") return { type: "hr" };
    if (TEXT_TYPES.has(block.type)) return { type: block.type, runs: cleanRuns(block.runs, where) };
    if (!Array.isArray(block.items)) throw new Error(`${where}: items must be an array`);
    return { type: block.type, items: block.items.map((runs, j) => cleanRuns(runs, `${where}.items[${j}]`)) };
  });
}

/** Word count of a body — drives readMinutes the same way the site's data did. */
export function countWords(blocks) {
  let text = "";
  for (const block of blocks) {
    const runs = block.runs ?? block.items?.flat() ?? [];
    for (const run of runs) if (run.text) text += ` ${run.text}`;
  }
  return text.split(/\s+/).filter(Boolean).length;
}

export const readMinutesFor = (words) => Math.max(1, Math.round(words / 200));
