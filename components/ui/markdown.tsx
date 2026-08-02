import { parseMarkdown, type Block, type Inline } from "@/lib/markdown";

/**
 * Renders the block tree from `lib/markdown.ts`. Deliberately styled here
 * rather than with a `prose` plugin: the reference's typography is dense and
 * calm, and Typography's defaults are neither.
 */
export function Markdown({
  source,
  skipLeadingHeading = false,
}: {
  source: string;
  /** Drop a heading that opens the document. A doc pasted from a file starts
   *  with its own title, and the reader already renders one above — without
   *  this the page says the same sentence twice, in two sizes. */
  skipLeadingHeading?: boolean;
}) {
  const parsed = parseMarkdown(source);
  const blocks =
    skipLeadingHeading && parsed[0]?.kind === "heading"
      ? parsed.slice(1)
      : parsed;

  if (blocks.length === 0) {
    return <p className="text-[13px] text-faint">Nothing written yet.</p>;
  }

  return (
    <div className="text-[13.5px] leading-relaxed text-ink/90">
      {blocks.map((block, index) => (
        <BlockView key={index} block={block} first={index === 0} />
      ))}
    </div>
  );
}

function BlockView({ block, first }: { block: Block; first: boolean }) {
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
          <InlineRun content={block.content} />
        </p>
      );
    }

    case "paragraph":
      return (
        <p className={first ? "" : "mt-3"}>
          <InlineRun content={block.content} />
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
              <InlineRun content={item} />
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
          <InlineRun content={block.content} />
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

function InlineRun({ content }: { content: Inline[] }) {
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
            return (
              <a
                key={index}
                href={piece.href}
                target="_blank"
                rel="noreferrer"
                className="text-accent underline decoration-accent/30 underline-offset-2 hover:decoration-accent"
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
