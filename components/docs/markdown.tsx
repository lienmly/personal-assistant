import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { cn } from "@/lib/utils";

/**
 * One renderer for both sources — Doc rows out of Postgres and the manuals read
 * off disk. They are stored differently and edited by different people; they
 * should not *look* different.
 *
 * Raw HTML is not enabled (`rehype-raw` is deliberately absent), so a doc can
 * never inject markup into the app. Nothing here needs it and the docs are
 * written in plain markdown anyway.
 *
 * Styling lives in `.doc-prose` in `globals.css` rather than in per-element
 * `components` overrides, so the manuals and the editor's preview can't drift
 * apart. The one component mapped here is the table, which needs a wrapper the
 * markdown AST has no node for.
 */
export function DocMarkdown({
  children,
  className,
}: {
  children: string;
  className?: string;
}) {
  return (
    <div className={cn("doc-prose", className)}>
      <Markdown
        remarkPlugins={[remarkGfm]}
        components={{
          // Both take only the props they need rather than spreading. The AST
          // `node` is passed to every component override and must not reach the
          // DOM — picking beats destructuring it out and leaving it unused.
          table: ({ children }) => (
            <div className="doc-table">
              <table>{children}</table>
            </div>
          ),
          // A link out of a doc leaves the app, so it opens in a new tab; an
          // in-page anchor stays put.
          a: ({ href, children }) =>
            href?.startsWith("http") ? (
              <a href={href} target="_blank" rel="noreferrer">
                {children}
              </a>
            ) : (
              <a href={href}>{children}</a>
            ),
        }}
      >
        {children}
      </Markdown>
    </div>
  );
}
