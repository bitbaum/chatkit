import type { ReactNode } from "react";
import {
  citedIds,
  isCardList,
  isInternalHref,
  listLead,
  parseBlocks,
  parseInline,
  type InlineSpan,
  type ListItem,
} from "../markdown.js";

/** What a grounded answer's `[F8]` / `[D1]` handle refers to. Unknown handles
 *  are dropped rather than shown bare: a dangling `[F8]` implies a source the
 *  reader cannot reach. */
export type CitationMap = Record<string, { label: string; detail: string; href?: string }>;

export type RenderLink = (link: {
  href: string;
  internal: boolean;
  className: string;
  children: ReactNode;
}) => ReactNode;

/** How a `[F1]` handle shows in the text. The default is a small superscript
 *  with the source in its tooltip; an app with its own source sheet renders
 *  that here instead. */
export type RenderCitation = (cite: {
  ids: string[];
  citations: CitationMap;
  className: string;
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

export const defaultRenderCitation: RenderCitation = ({ ids, citations, className }) => (
  <sup
    className={className}
    title={ids
      .map((id) => `${id} — ${citations[id]!.label}\n${citations[id]!.detail}`)
      .join("\n\n")}
  >
    {ids.join(" ")}
  </sup>
);

function Inline({
  spans,
  citations,
  renderLink,
  renderCitation,
}: {
  spans: InlineSpan[];
  citations?: CitationMap;
  renderLink: RenderLink;
  renderCitation: RenderCitation;
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
          case "em": {
            // Plain emphasis stays plain markup; only what holds a link, code
            // or a citation is rendered as nested spans.
            const plain = s.children.every((c) => c.kind === "text");
            const inner = plain ? (
              s.text
            ) : (
              <Inline
                spans={s.children}
                citations={citations}
                renderLink={renderLink}
                renderCitation={renderCitation}
              />
            );
            return s.kind === "strong" ? (
              <strong key={i}>{inner}</strong>
            ) : (
              <em key={i}>{inner}</em>
            );
          }
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
          case "image":
            return <img key={i} className="ck-img" src={s.src} alt={s.alt} loading="lazy" />;
          case "cite": {
            const known = s.ids.filter((id) => citations?.[id]);
            if (known.length === 0 || !citations) return null;
            return (
              <span key={i}>{renderCitation({ ids: known, citations, className: "ck-cite" })}</span>
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
 * Model output as readable text: paragraphs, lists, headings, tables, bold,
 * italic, code, links, images and citations. Never HTML — nothing here can
 * inject markup.
 *
 * A list of named things (`1. **Option.** why`) becomes cards with a badge,
 * a name and a body; a table becomes a table that scrolls sideways on a phone
 * instead of breaking the page; the sources an answer cites are listed once
 * under it as chips.
 */
export function Markdown({
  text,
  citations,
  renderLink = defaultRenderLink,
  renderCitation = defaultRenderCitation,
  sources = true,
  sourcesLabel = "Sources",
  className,
}: {
  text: string;
  citations?: CitationMap;
  renderLink?: RenderLink;
  renderCitation?: RenderCitation;
  /** The chip row of cited sources under the answer (needs `citations`). */
  sources?: boolean;
  sourcesLabel?: string;
  className?: string;
}) {
  const inline = (t: string) => (
    <Inline
      spans={parseInline(t)}
      citations={citations}
      renderLink={renderLink}
      renderCitation={renderCitation}
    />
  );
  const items = (list: ListItem[], ordered: boolean, start = 1) => {
    const List = ordered ? "ol" : "ul";
    return (
      <List start={ordered && start !== 1 ? start : undefined}>
        {list.map((item, j) => (
          <li key={j} className={item.task !== undefined ? "ck-task" : undefined}>
            {item.task !== undefined && (
              <input type="checkbox" checked={item.task} readOnly aria-hidden tabIndex={-1} />
            )}
            {inline(item.text)}
            {item.children && items(item.children, false)}
          </li>
        ))}
      </List>
    );
  };
  const cards = (list: ListItem[], ordered: boolean, start = 1) => (
    <ol className={ordered ? "ck-cards ck-cards-numbered" : "ck-cards"}>
      {list.map((item, j) => {
        const lead = listLead(item.text)!;
        return (
          <li key={j} className="ck-card">
            <span
              className={lead.icon ? "ck-card-badge ck-card-icon" : "ck-card-badge"}
              aria-hidden
            >
              {lead.icon ?? (ordered ? start + j : "•")}
            </span>
            <div className="ck-card-body">
              <div className="ck-card-title">{inline(lead.lead)}</div>
              {lead.rest && <div className="ck-card-text">{inline(lead.rest)}</div>}
              {item.children && items(item.children, false)}
            </div>
          </li>
        );
      })}
    </ol>
  );
  const cited = citations ? citedIds(text).filter((id) => citations[id]) : [];

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
            return (
              <div key={i}>
                {isCardList(b.items) ? cards(b.items, false) : items(b.items, false)}
              </div>
            );
          case "ol":
            return (
              <div key={i}>
                {isCardList(b.items)
                  ? cards(b.items, true, b.start)
                  : items(b.items, true, b.start)}
              </div>
            );
          case "h": {
            const H = b.level === 1 ? "h2" : b.level === 2 ? "h3" : "h4";
            return (
              <H key={i} className={`ck-md-h ck-md-h${b.level}`}>
                {inline(b.text)}
              </H>
            );
          }
          case "quote":
            return (
              <blockquote key={i}>
                {b.text.split("\n").map((line, j) => (
                  <p key={j}>{inline(line)}</p>
                ))}
              </blockquote>
            );
          case "table":
            return (
              <div key={i} className="ck-table-wrap">
                <table className="ck-table">
                  <thead>
                    <tr>
                      {b.head.map((cell, j) => (
                        <th key={j}>{inline(cell)}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {b.rows.map((row, j) => (
                      <tr key={j}>
                        {b.head.map((_, k) => (
                          <td key={k}>{inline(row[k] ?? "")}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          case "hr":
            return <hr key={i} className="ck-hr" />;
          default:
            return <p key={i}>{inline(b.text)}</p>;
        }
      })}
      {sources && cited.length > 0 && citations && (
        <div className="ck-sources" role="list" aria-label={sourcesLabel}>
          <span className="ck-sources-label">{sourcesLabel}</span>
          {cited.map((id) => {
            const c = citations[id]!;
            const chip = (
              <>
                <span className="ck-source-id">{id}</span>
                <span className="ck-source-label">{c.label}</span>
              </>
            );
            return c.href ? (
              <span key={id} role="listitem">
                {renderLink({
                  href: c.href,
                  internal: isInternalHref(c.href),
                  className: "ck-source",
                  children: chip,
                })}
              </span>
            ) : (
              <span key={id} role="listitem" className="ck-source" title={c.detail}>
                {chip}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}
