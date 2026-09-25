import type { ReactNode } from "react";
import { isInternalHref, parseBlocks, parseInline, type InlineSpan } from "../markdown.js";

/** What a grounded answer's `[F8]` / `[D1]` handle refers to. Unknown handles
 *  are dropped rather than shown bare: a dangling `[F8]` implies a source the
 *  reader cannot reach. */
export type CitationMap = Record<string, { label: string; detail: string }>;

export type RenderLink = (link: {
  href: string;
  internal: boolean;
  className: string;
  children: ReactNode;
}) => ReactNode;

/** A plain anchor: same-site paths in place, everything else in a new tab. */
export const defaultRenderLink: RenderLink = ({ href, internal, className, children }) =>
  internal ? (
    <a href={href} className={className}>
      {children}
    </a>
  ) : (
    <a href={href} className={className} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  );

function Inline({
  spans,
  citations,
  renderLink,
}: {
  spans: InlineSpan[];
  citations?: CitationMap;
  renderLink: RenderLink;
}) {
  return (
    <>
      {spans.map((s, i) => {
        switch (s.kind) {
          case "code":
            return (
              <code key={i} className="ck-code">
                {s.text}
              </code>
            );
          case "strong":
            return <strong key={i}>{s.text}</strong>;
          case "em":
            return <em key={i}>{s.text}</em>;
          case "link":
            return (
              <span key={i}>
                {renderLink({
                  href: s.href,
                  internal: isInternalHref(s.href),
                  className: "ck-link",
                  children: s.text,
                })}
              </span>
            );
          case "cite": {
            const known = s.ids.filter((id) => citations?.[id]);
            if (known.length === 0) return null;
            return (
              <sup
                key={i}
                className="ck-cite"
                title={known
                  .map((id) => `${id} — ${citations![id]!.label}\n${citations![id]!.detail}`)
                  .join("\n\n")}
              >
                {known.join(" ")}
              </sup>
            );
          }
          default:
            return <span key={i}>{s.text}</span>;
        }
      })}
    </>
  );
}

/**
 * Model output as readable text: paragraphs, lists, headings, bold, italic,
 * code, links and citations. Never HTML — nothing here can inject markup.
 */
export function Markdown({
  text,
  citations,
  renderLink = defaultRenderLink,
  className,
}: {
  text: string;
  citations?: CitationMap;
  renderLink?: RenderLink;
  className?: string;
}) {
  const inline = (t: string) => (
    <Inline spans={parseInline(t)} citations={citations} renderLink={renderLink} />
  );
  return (
    <div className={className ? `ck-md ${className}` : "ck-md"}>
      {parseBlocks(text).map((b, i) => {
        switch (b.kind) {
          case "code":
            return (
              <pre key={i} className="ck-pre" data-lang={b.lang || undefined}>
                <code>{b.code}</code>
              </pre>
            );
          case "ul":
          case "ol": {
            const List = b.kind;
            return (
              <List key={i}>
                {b.items.map((item, j) => (
                  <li key={j}>{inline(item)}</li>
                ))}
              </List>
            );
          }
          case "h":
            return (
              <p key={i} className="ck-md-h">
                {inline(b.text)}
              </p>
            );
          case "quote":
            return <blockquote key={i}>{inline(b.text)}</blockquote>;
          default:
            return <p key={i}>{inline(b.text)}</p>;
        }
      })}
    </div>
  );
}
