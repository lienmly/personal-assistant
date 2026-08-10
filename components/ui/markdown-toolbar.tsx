"use client";

import {
  Bold,
  Code,
  Italic,
  Link2,
  List,
  ListOrdered,
  Quote,
} from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * A formatting row for a Markdown textarea.
 *
 * The renderer is `lib/markdown.ts` — a deliberately small subset — so this
 * offers exactly what that subset can render and nothing else. A button that
 * inserts syntax the renderer prints as literal characters would be worse than
 * no button at all.
 *
 * **It writes into the textarea, it does not own its value.** Every field in
 * this app is uncontrolled and read out of `FormData` on submit, and a toolbar
 * that lifted the body into React state would make the composer a controlled
 * form for the sake of seven buttons. So the actions take the element and edit
 * it in place, which is also what lets Ctrl+B work identically without going
 * through this component at all.
 *
 * **Edits go through `execCommand("insertText")` where it exists**, because that
 * is the only way to change a textarea's value and keep the browser's native
 * undo stack. `setRangeText` — the modern, non-deprecated call — silently
 * discards it, so bolding a word would make Ctrl+Z throw away everything typed
 * before it. It is the fallback rather than the default for that reason.
 */
export type MarkdownAction =
  | "bold"
  | "italic"
  | "code"
  | "link"
  | "bullet"
  | "ordered"
  | "quote";

const WRAPPERS: Partial<Record<MarkdownAction, string>> = {
  bold: "**",
  italic: "*",
  code: "`",
};

/** Any list or quote marker, so switching between them replaces rather than
 *  stacks. Mirrors the three patterns `parseMarkdown` recognises. */
const ANY_MARKER = /^(\s*)(?:[-*+]\s+|\d+[.)]\s+|>\s?)/;

function replace(
  el: HTMLTextAreaElement,
  start: number,
  end: number,
  text: string,
) {
  el.focus();
  el.setSelectionRange(start, end);

  // `insertText` refuses an empty string in some browsers, so a pure deletion
  // takes the fallback. Everything else keeps the undo stack.
  if (text !== "") {
    try {
      if (document.execCommand("insertText", false, text)) return;
    } catch {
      // Deprecated and allowed to throw. Fall through.
    }
  }
  el.setRangeText(text, start, end, "end");
}

/** How many of `ch` the string ends with / starts with. */
function trailing(text: string, ch: string): number {
  let n = 0;
  while (n < text.length && text[text.length - 1 - n] === ch) n++;
  return n;
}

function leading(text: string, ch: string): number {
  let n = 0;
  while (n < text.length && text[n] === ch) n++;
  return n;
}

function wrap(el: HTMLTextAreaElement, marker: string) {
  const { selectionStart: start, selectionEnd: end, value } = el;
  const before = value.slice(0, start);
  const after = value.slice(end);
  const selected = value.slice(start, end);

  // `*` is a prefix of `**`, so asking "does this already have my markers on
  // it" by string comparison gets `***bold and italic***` wrong in both
  // directions — italic reads the bold pair as its own and eats one off each
  // end, or (worse) declines to unwrap and adds a fourth. Count the run
  // instead: an odd run has an italic marker in it, a run of two or more has a
  // bold pair.
  const around =
    marker === "*"
      ? trailing(before, "*") % 2 === 1 && leading(after, "*") % 2 === 1
      : marker === "**"
        ? trailing(before, "*") >= 2 && leading(after, "*") >= 2
        : before.endsWith(marker) && after.startsWith(marker);

  if (around) {
    replace(el, start - marker.length, end + marker.length, selected);
    el.setSelectionRange(start - marker.length, end - marker.length);
    return;
  }

  if (
    selected.length > marker.length * 2 &&
    selected.startsWith(marker) &&
    selected.endsWith(marker)
  ) {
    const inner = selected.slice(marker.length, -marker.length);
    replace(el, start, end, inner);
    el.setSelectionRange(start, start + inner.length);
    return;
  }

  replace(el, start, end, `${marker}${selected}${marker}`);
  el.setSelectionRange(
    start + marker.length,
    start + marker.length + selected.length,
  );
}

function link(el: HTMLTextAreaElement) {
  const { selectionStart: start, selectionEnd: end, value } = el;
  const selected = value.slice(start, end);
  const label = selected || "text";
  const href = "https://";

  replace(el, start, end, `[${label}](${href})`);
  // Land on whichever half still needs typing: the address if there was
  // already a label, the label if there wasn't.
  if (selected) {
    const at = start + label.length + 3;
    el.setSelectionRange(at, at + href.length);
  } else {
    el.setSelectionRange(start + 1, start + 1 + label.length);
  }
}

function markLines(
  el: HTMLTextAreaElement,
  marker: (index: number) => string,
  has: RegExp,
) {
  const { selectionStart: start, selectionEnd: end, value } = el;
  const from = value.lastIndexOf("\n", start - 1) + 1;
  const break_ = value.indexOf("\n", end);
  const to = break_ === -1 ? value.length : break_;

  const lines = value.slice(from, to).split("\n");
  const on = lines.every((line) => line.trim() === "" || has.test(line));

  const next = lines
    .map((line, index) => {
      if (on) return line.replace(has, "$1");
      // Whatever marker the line already had comes off, so bullet → numbered
      // replaces rather than stacks. The new one goes *after* any indent.
      const bare = line.replace(ANY_MARKER, "$1");
      const indent = /^\s*/.exec(bare)?.[0] ?? "";
      return `${indent}${marker(index)}${bare.slice(indent.length)}`;
    })
    .join("\n");

  replace(el, from, to, next);
  el.setSelectionRange(from, from + next.length);
}

export function applyMarkdown(el: HTMLTextAreaElement, action: MarkdownAction) {
  const wrapper = WRAPPERS[action];
  if (wrapper) {
    wrap(el, wrapper);
    return;
  }
  if (action === "link") {
    link(el);
    return;
  }
  if (action === "bullet") {
    markLines(el, () => "- ", /^(\s*)[-*+]\s+/);
    return;
  }
  if (action === "ordered") {
    markLines(el, (index) => `${index + 1}. `, /^(\s*)\d+[.)]\s+/);
    return;
  }
  markLines(el, () => "> ", /^(\s*)>\s?/);
}

/** Ctrl/⌘ shortcuts, for a textarea that has this toolbar above it. Returns
 *  true when it handled the event, so the caller can stop there. */
export function handleMarkdownShortcut(
  event: React.KeyboardEvent<HTMLTextAreaElement>,
): boolean {
  if (!event.metaKey && !event.ctrlKey) return false;

  const action: MarkdownAction | null =
    event.key === "b"
      ? "bold"
      : event.key === "i"
        ? "italic"
        : event.key === "k"
          ? "link"
          : null;
  if (!action) return false;

  event.preventDefault();
  applyMarkdown(event.currentTarget, action);
  return true;
}

const BUTTONS: {
  action: MarkdownAction;
  label: string;
  hint: string;
  Icon: typeof Bold;
}[] = [
  { action: "bold", label: "Bold", hint: "Bold (Ctrl+B)", Icon: Bold },
  { action: "italic", label: "Italic", hint: "Italic (Ctrl+I)", Icon: Italic },
  { action: "link", label: "Link", hint: "Link (Ctrl+K)", Icon: Link2 },
  { action: "bullet", label: "Bulleted list", hint: "Bulleted list", Icon: List },
  {
    action: "ordered",
    label: "Numbered list",
    hint: "Numbered list",
    Icon: ListOrdered,
  },
  { action: "quote", label: "Quote", hint: "Quote", Icon: Quote },
  { action: "code", label: "Code", hint: "Code", Icon: Code },
];

export function MarkdownToolbar({
  targetRef,
  className,
}: {
  targetRef: React.RefObject<HTMLTextAreaElement | null>;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-center gap-0.5", className)}>
      {BUTTONS.map(({ action, label, hint, Icon }) => (
        <button
          key={action}
          type="button"
          aria-label={label}
          title={hint}
          // The textarea must not lose the selection the button is about to
          // act on, and a mousedown on a button is what would take it.
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => {
            const el = targetRef.current;
            if (el) applyMarkdown(el, action);
          }}
          className="grid size-7 place-items-center rounded-chip text-faint transition-colors duration-(--duration-quick) hover:bg-inset hover:text-ink active:scale-90"
        >
          <Icon className="size-3.5" strokeWidth={2} />
        </button>
      ))}
    </div>
  );
}
