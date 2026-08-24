import Link from "next/link";

import { parseMarkdown, type Block, type Inline } from "@/lib/markdown";

/**
 * Renders the block tree from `lib/markdown.ts`. Deliberately styled here
 * rather than with a `prose` plugin: the reference's typography is dense and
 * calm, and Typography's defaults are neither.
 */
export function Markdown({
  source,
  breaks = false,
  skipLeadingHeading = false,
  className = "text-[13.5px] leading-relaxed text-ink/90",
  onLinkClick,
}: {
  source: string;
  /** Treat a single newline as a line break rather than joining the lines.
   *  What a journal entry wants and a doc does not — see `parseMarkdown`. */
  breaks?: boolean;
  /** Drop a heading that opens the document. A doc pasted from a file starts
   *  with its own title, and the reader already renders one above — without
   *  this the page says the same sentence twice, in two sizes. */
  skipLeadingHeading?: boolean;
  /** The root type scale. Defaults to the doc reader's, which is what every
   *  page-sized caller wants; Montblanc's drawer is a size down. */
  className?: string;
  /** Called when an in-app link is followed, so an overlay that renders this
   *  can get out of the way. Never fires for an external link — that one
   *  opens a tab and leaves this page alone. */
  onLinkClick?: () => void;
}) {
  const parsed = parseMarkdown(source, { breaks });
  const blocks =
    skipLeadingHeading && parsed[0]?.kind === "heading"
      ? parsed.slice(1)
      : parsed;

  if (blocks.length === 0) {
    return <p className="text-[13px] text-faint">Nothing written yet.</p>;
  }

  return (
    <div className={className}>
      {blocks.map((block, index) => (
        <BlockView
          key={index}
          block={block}
          first={index === 0}
          onLinkClick={onLinkClick}
        />
      ))}
    </div>
  );
}

function BlockView({
  block,
  first,
  onLinkClick,
}: {
  block: Block;
  first: boolean;
  onLinkClick?: () => void;
}) {
  switch (block.kind) {
    case "heading": {
      const size =
        block.level === 2
          ? "text-[15px] font-semibold tracking-tight"
          : block.level === 3
            ? "text-[13.5px] font-semibold"
            : "text-[12px] font-semibold uppercase tracking-[0.08em] text-faint";
      return (
        <p className={`${first ? "" : "mt-5"} mb-2 text-ink ${size}`}>
          <InlineRun content={block.content} onLinkClick={onLinkClick} />
        </p>
      );
    }

    case "paragraph":
      return (
        <p className={first ? "" : "mt-3"}>
          <InlineRun content={block.content} onLinkClick={onLinkClick} />
        </p>
      );

    case "list": {
      const Tag = block.ordered ? "ol" : "ul";
      return (
        <Tag
          className={`${first ? "" : "mt-3"} ml-4 flex flex-col gap-1.5 ${
            block.ordered ? "list-decimal" : "list-disc"
          } marker:text-faint`}
        >
          {block.items.map((item, index) => (
            <li key={index} className="pl-1">
              <InlineRun content={item} onLinkClick={onLinkClick} />
            </li>
          ))}
        </Tag>
      );
    }

    case "quote":
      return (
        <p
          className={`${first ? "" : "mt-3"} rounded-tile bg-inset px-3.5 py-2.5 text-muted`}
        >
          <InlineRun content={block.content} onLinkClick={onLinkClick} />
        </p>
      );

    case "code":
      return (
        <pre
          className={`${first ? "" : "mt-3"} overflow-x-auto rounded-tile bg-inset px-3.5 py-3 text-[12.5px] leading-relaxed text-ink/80`}
        >
          <code>{block.text}</code>
        </pre>
      );

    case "rule":
      return <hr className="my-5 border-line/70" />;
  }
}

/** The one class both link kinds wear, so an in-app link and an outward one
 *  are told apart by where they go and never by how they look.
 *
 *  `break-words` because a link whose text is its own URL is a single
 *  unbroken word, and in a 390px drawer that scrolls the message sideways. */
const LINK_CLASS =
  "break-words text-accent underline decoration-accent/30 underline-offset-2 hover:decoration-accent";

function InlineRun({
  content,
  onLinkClick,
}: {
  content: Inline[];
  onLinkClick?: () => void;
}) {
  return (
    <>
      {content.map((piece, index) => {
        switch (piece.kind) {
          case "bold":
            return (
              <strong key={index} className="font-semibold text-ink">
                {piece.text}
              </strong>
            );
          case "italic":
            return <em key={index}>{piece.text}</em>;
          case "break":
            return <br key={index} />;
          case "code":
            return (
              <code
                key={index}
                className="rounded bg-inset px-1.5 py-0.5 text-[12.5px] text-ink/80"
              >
                {piece.text}
              </code>
            );
          case "link":
            // `safeHref` admits in-app paths as well as http(s), so a doc
            // linking to another doc used to open in a new tab and leave the
            // app — a router push is what an internal link has always meant.
            return piece.href.startsWith("/") ? (
              <Link
                key={index}
                href={piece.href}
                onClick={onLinkClick}
                className={LINK_CLASS}
              >
                {piece.text}
              </Link>
            ) : (
              <a
                key={index}
                href={piece.href}
                target="_blank"
                rel="noreferrer"
                className={LINK_CLASS}
              >
                {piece.text}
              </a>
            );
          default:
            return <span key={index}>{piece.text}</span>;
        }
      })}
    </>
  );
}
