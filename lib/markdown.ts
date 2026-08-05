/**
 * A deliberately small Markdown subset, rendered to a token tree the doc view
 * walks into JSX.
 *
 * The alternative is `react-markdown` plus `remark-gfm` plus `rehype-sanitize`
 * — three dependencies and a sanitiser pass — for content that only I can
 * write, on a single-tenant app behind an allowlist. What a project doc
 * actually contains is headings, lists, links, bold and the occasional code
 * span; that is what this handles, and anything it doesn't recognise renders as
 * the plain text it already was rather than disappearing.
 *
 * No HTML passthrough at all. Not because a stored-XSS route exists today, but
 * because the moment docs become shareable (Phase 7's multi-user) it would, and
 * a renderer that never had the feature can't grow the hole.
 */

export type Inline =
  | { kind: "text"; text: string }
  | { kind: "bold"; text: string }
  | { kind: "italic"; text: string }
  | { kind: "code"; text: string }
  | { kind: "link"; text: string; href: string };

export type Block =
  | { kind: "heading"; level: 2 | 3 | 4; content: Inline[] }
  | { kind: "paragraph"; content: Inline[] }
  | { kind: "list"; ordered: boolean; items: Inline[][] }
  | { kind: "quote"; content: Inline[] }
  | { kind: "code"; text: string }
  | { kind: "rule" };

/** Only http(s) and mailto survive. A `javascript:` href in a doc is the one
 *  way this renderer could execute anything, so it is filtered at the source
 *  rather than at the component. */
function safeHref(href: string): string | null {
  const trimmed = href.trim();
  return /^(https?:\/\/|mailto:|\/)/i.test(trimmed) ? trimmed : null;
}

/**
 * Does this line open a block of its own?
 *
 * Used to tell a *wrapped* line — the second line of a bullet that ran past 80
 * characters — from the start of something new. Without it, a list run breaks
 * at the first continuation line and the remainder of the item renders as a
 * stray paragraph immediately after a list of one.
 */
function opensBlock(trimmed: string): boolean {
  return (
    trimmed.startsWith("```") ||
    trimmed.startsWith(">") ||
    /^(-{3,}|_{3,}|\*{3,})$/.test(trimmed) ||
    /^#{1,6}\s/.test(trimmed)
  );
}

const INLINE =
  /(\*\*([^*]+)\*\*)|(\*([^*]+)\*)|(`([^`]+)`)|(\[([^\]]+)\]\(([^)\s]+)\))/;

function parseInline(source: string): Inline[] {
  const out: Inline[] = [];
  let rest = source;

  while (rest.length > 0) {
    const match = INLINE.exec(rest);
    if (!match || match.index === undefined) break;

    if (match.index > 0) {
      out.push({ kind: "text", text: rest.slice(0, match.index) });
    }

    if (match[2] !== undefined) out.push({ kind: "bold", text: match[2] });
    else if (match[4] !== undefined) out.push({ kind: "italic", text: match[4] });
    else if (match[6] !== undefined) out.push({ kind: "code", text: match[6] });
    else if (match[8] !== undefined) {
      const href = safeHref(match[9]);
      // A rejected href keeps its label rather than vanishing — losing the
      // words is worse than losing the link.
      out.push(
        href
          ? { kind: "link", text: match[8], href }
          : { kind: "text", text: match[8] },
      );
    }

    rest = rest.slice(match.index + match[0].length);
  }

  if (rest.length > 0) out.push({ kind: "text", text: rest });
  return out;
}

/** Markdown source → blocks. Never throws: unparseable input is a paragraph. */
export function parseMarkdown(source: string): Block[] {
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  const blocks: Block[] = [];
  let paragraph: string[] = [];

  const flush = () => {
    if (paragraph.length === 0) return;
    blocks.push({ kind: "paragraph", content: parseInline(paragraph.join(" ")) });
    paragraph = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (trimmed === "") {
      flush();
      continue;
    }

    if (trimmed.startsWith("```")) {
      flush();
      const body: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith("```")) {
        body.push(lines[i]);
        i++;
      }
      blocks.push({ kind: "code", text: body.join("\n") });
      continue;
    }

    if (/^(-{3,}|_{3,}|\*{3,})$/.test(trimmed)) {
      flush();
      blocks.push({ kind: "rule" });
      continue;
    }

    const heading = /^(#{1,6})\s+(.*)$/.exec(trimmed);
    if (heading) {
      flush();
      // `#` and `##` both render as level 2: the page already supplies an h1,
      // and a doc pasted from a file usually starts with its own title.
      const level = Math.min(Math.max(heading[1].length, 2), 4) as 2 | 3 | 4;
      blocks.push({ kind: "heading", level, content: parseInline(heading[2]) });
      continue;
    }

    if (trimmed.startsWith(">")) {
      flush();

      // Consume the whole run. Emitting one block per *line* — which is what
      // this did until 2026-08-05 — turns a wrapped blockquote into a stack of
      // one-line quotes, and matching on `"> "` with the trailing space left a
      // bare `>` (the separator between two quoted paragraphs) to fall through
      // and render as a paragraph containing the character ">".
      const quoted: string[] = [];
      let current: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith(">")) {
        const text = lines[i].trim().replace(/^>\s?/, "");
        if (text === "") {
          if (current.length > 0) quoted.push(current.join(" "));
          current = [];
        } else {
          current.push(text);
        }
        i++;
      }
      i--; // the loop's own i++ steps past the last quoted line
      if (current.length > 0) quoted.push(current.join(" "));

      for (const para of quoted) {
        blocks.push({ kind: "quote", content: parseInline(para) });
      }
      continue;
    }

    const bullet = /^[-*+]\s+(.*)$/.exec(trimmed);
    const numbered = /^\d+[.)]\s+(.*)$/.exec(trimmed);
    if (bullet || numbered) {
      flush();
      const ordered = numbered !== null;
      // Collected as raw strings rather than parsed immediately, because a
      // wrapped item is only complete once its continuation lines are in.
      const rows: string[] = [(bullet ?? numbered)![1]];

      // Consume the rest of the run here rather than emitting one list per
      // line, so the markup is a single <ul> and the spacing is the list's.
      while (i + 1 < lines.length) {
        const next = lines[i + 1].trim();
        if (next === "") break;

        const nextBullet = /^[-*+]\s+(.*)$/.exec(next);
        const nextNumbered = /^\d+[.)]\s+(.*)$/.exec(next);
        const match = ordered ? nextNumbered : nextBullet;
        if (match) {
          rows.push(match[1]);
          i++;
          continue;
        }
        // A different marker, or the start of any other block, ends the run.
        if (nextBullet || nextNumbered || opensBlock(next)) break;

        // Otherwise it is the previous item, wrapped. `forge-vision.md` had
        // been rendering its wrapped bullets as a list of one plus a loose
        // paragraph since it was written (noted in CLAUDE.md 2026-08-03).
        rows[rows.length - 1] += ` ${next}`;
        i++;
      }

      blocks.push({ kind: "list", ordered, items: rows.map(parseInline) });
      continue;
    }

    paragraph.push(trimmed);
  }

  flush();
  return blocks;
}

/** First non-heading line, for the doc list's one-line preview. */
export function docExcerpt(body: string, max = 96): string {
  const line = body
    .split("\n")
    .map((row) => row.trim())
    .find((row) => row !== "" && !row.startsWith("#") && !row.startsWith("---"));
  if (!line) return "Empty";
  const plain = line.replace(/[*`>[\]]/g, "").replace(/\(([^)]*)\)/g, "");
  return plain.length > max ? `${plain.slice(0, max - 1)}…` : plain;
}
