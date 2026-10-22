"use client";

import { useState, type ReactNode } from "react";
import { parseRichBlock } from "../rich.js";
import { RichAnswerBlock } from "./RichBlock.js";
import { IconBook } from "./icons.js";
import { Sheet, prefersSheet } from "./Sheet.js";
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

/** The sources an answer cites, listed once under it. The default is the chip
 *  row; an app with its own source sheet renders that here instead. */
export type RenderSources = (sources: {
  records: { id: string; label: string; detail: string; href?: string }[];
  label: string;
}) => ReactNode;

/** A plain anchor: same-site paths in place, everything else in a new tab. */
export const defaultRenderLink: RenderLink = ({ href, internal, className, children }) =>
  internal ? (
    <a href={href} className={className}>
      {children}
    </a>
  ) : className === "ck-link" ? (
    // A link in the words that leaves the site says so, the way the ChatGPT
    // app marks one: a dotted underline and a small arrow after the words. A
    // source chip is already a link by shape and carries no arrow.
    <a href={href} className="ck-link ck-link-out" target="_blank" rel="noopener noreferrer">
      {children}
      <span className="ck-link-arrow" aria-hidden>
        ↗
      </span>
    </a>
  ) : (
    <a href={href} className={className} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  );

/**
 * The sources an answer cites, listed once under it. On a mouse, a row of
 * chips. On a touch screen, ONE "Sources" button that opens a sheet with every
 * record — its label, what it is, and a link — the way the ChatGPT app lists
 * them: a row of chips on a phone was a row of cut-off words.
 */
export function SourcesRow({
  records,
  label,
  renderLink = defaultRenderLink,
}: {
  records: { id: string; label: string; detail: string; href?: string }[];
  label: string;
  renderLink?: RenderLink;
}) {
  const [open, setOpen] = useState(false);
  const sheet = prefersSheet();
  if (records.length === 0) return null;
  if (!sheet) {
    return (
      <div className="ck-sources" role="list" aria-label={label}>
        <span className="ck-sources-label">{label}</span>
        {records.map((c) => {
          const chip = (
            <>
              <span className="ck-source-id">{c.id}</span>
              <span className="ck-source-label">{c.label}</span>
            </>
          );
          return c.href ? (
            <span key={c.id} role="listitem">
              {renderLink({
                href: c.href,
                internal: isInternalHref(c.href),
                className: "ck-source",
                children: chip,
              })}
            </span>
          ) : (
            <span key={c.id} role="listitem" className="ck-source" title={c.detail}>
              {chip}
            </span>
          );
        })}
      </div>
    );
  }
  return (
    <div className="ck-sources">
      <button
        type="button"
        className="ck-source ck-sources-open"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
      >
        <IconBook />
        <span className="ck-source-label">
          {label} · {records.length}
        </span>
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title={label}>
        <ol className="ck-source-list">
          {records.map((c) => {
            const body = (
              <>
                <span className="ck-source-id">{c.id}</span>
                <span className="ck-source-body">
                  <span className="ck-source-title">{c.label}</span>
                  {c.detail && c.detail !== c.label && (
                    <span className="ck-source-detail">{c.detail}</span>
                  )}
                </span>
              </>
            );
            return (
              <li key={c.id}>
                {c.href ? (
                  renderLink({
                    href: c.href,
                    internal: isInternalHref(c.href),
                    className: "ck-source-row",
                    children: body,
                  })
                ) : (
                  <span className="ck-source-row">{body}</span>
                )}
              </li>
            );
          })}
        </ol>
      </Sheet>
    </div>
  );
}

/** The in-text citation as a chip: the first source's name, and how many
 *  more stand behind the sentence — the ChatGPT app's "NVIDIA De… +3". The
 *  full list stays in the sources row under the answer. */
export const defaultRenderCitation: RenderCitation = ({ ids, citations, className }) => {
  const first = citations[ids[0]!]!;
  const title = ids
    .map((id) => `${id} — ${citations[id]!.label}\n${citations[id]!.detail}`)
    .join("\n\n");
  const chip = (
    <>
      <span className="ck-cite-label">{first.label}</span>
      {ids.length > 1 && <span className="ck-cite-more">+{ids.length - 1}</span>}
    </>
  );
  return first.href ? (
    <a
      className={className}
      href={first.href}
      title={title}
      target="_blank"
      rel="noopener noreferrer"
    >
      {chip}
    </a>
  ) : (
    <span className={className} title={title}>
      {chip}
    </span>
  );
};

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
  renderSources,
  sources = true,
  sourcesLabel = "Sources",
  className,
  onReply,
}: {
  text: string;
  /** A visual choice sends a normal conversation message. Omit while streaming. */
  onReply?: (text: string) => void;
  citations?: CitationMap;
  renderLink?: RenderLink;
  renderCitation?: RenderCitation;
  /** Your own sources row (a button that opens a sheet) in place of the chips. */
  renderSources?: RenderSources;
  /** The row of cited sources under the answer (needs `citations`). */
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
              {lead.tag && <span className="ck-card-tag">{lead.tag}</span>}
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
          case "code": {
            if (b.lang === "chat_ui") {
              const block = parseRichBlock(b.code);
              if (block) return <RichAnswerBlock key={i} block={block} onReply={onReply} />;
              // A partial JSON block must not flash in the conversation.
              return null;
            }
            return (
              <pre key={i} className="ck-pre" data-lang={b.lang || undefined}>
                <code>{b.code}</code>
              </pre>
            );
          }
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
      {sources && cited.length > 0 && citations && renderSources ? (
        renderSources({
          records: cited.map((id) => ({ id, ...citations[id]! })),
          label: sourcesLabel,
        })
      ) : sources && cited.length > 0 && citations ? (
        <SourcesRow
          records={cited.map((id) => ({ id, ...citations[id]! }))}
          label={sourcesLabel}
          renderLink={renderLink}
        />
      ) : null}
    </div>
  );
}
