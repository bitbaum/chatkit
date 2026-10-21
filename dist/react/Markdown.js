"use client";
import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
import { IconBook } from "./icons.js";
import { Sheet, prefersSheet } from "./Sheet.js";
import { citedIds, isCardList, isInternalHref, listLead, parseBlocks, parseInline, } from "../markdown.js";
/** A plain anchor: same-site paths in place, everything else in a new tab. */
export const defaultRenderLink = ({ href, internal, className, children }) => internal ? (_jsx("a", { href: href, className: className, children: children })) : (_jsx("a", { href: href, className: className, target: "_blank", rel: "noopener noreferrer", children: children }));
/**
 * The sources an answer cites, listed once under it. On a mouse, a row of
 * chips. On a touch screen, ONE "Sources" button that opens a sheet with every
 * record — its label, what it is, and a link — the way the ChatGPT app lists
 * them: a row of chips on a phone was a row of cut-off words.
 */
export function SourcesRow({ records, label, renderLink = defaultRenderLink, }) {
    const [open, setOpen] = useState(false);
    const sheet = prefersSheet();
    if (records.length === 0)
        return null;
    if (!sheet) {
        return (_jsxs("div", { className: "ck-sources", role: "list", "aria-label": label, children: [_jsx("span", { className: "ck-sources-label", children: label }), records.map((c) => {
                    const chip = (_jsxs(_Fragment, { children: [_jsx("span", { className: "ck-source-id", children: c.id }), _jsx("span", { className: "ck-source-label", children: c.label })] }));
                    return c.href ? (_jsx("span", { role: "listitem", children: renderLink({
                            href: c.href,
                            internal: isInternalHref(c.href),
                            className: "ck-source",
                            children: chip,
                        }) }, c.id)) : (_jsx("span", { role: "listitem", className: "ck-source", title: c.detail, children: chip }, c.id));
                })] }));
    }
    return (_jsxs("div", { className: "ck-sources", children: [_jsxs("button", { type: "button", className: "ck-source ck-sources-open", onClick: () => setOpen(true), "aria-haspopup": "dialog", children: [_jsx(IconBook, {}), _jsxs("span", { className: "ck-source-label", children: [label, " \u00B7 ", records.length] })] }), _jsx(Sheet, { open: open, onClose: () => setOpen(false), title: label, children: _jsx("ol", { className: "ck-source-list", children: records.map((c) => {
                        const body = (_jsxs(_Fragment, { children: [_jsx("span", { className: "ck-source-id", children: c.id }), _jsxs("span", { className: "ck-source-body", children: [_jsx("span", { className: "ck-source-title", children: c.label }), c.detail && c.detail !== c.label && (_jsx("span", { className: "ck-source-detail", children: c.detail }))] })] }));
                        return (_jsx("li", { children: c.href ? (renderLink({
                                href: c.href,
                                internal: isInternalHref(c.href),
                                className: "ck-source-row",
                                children: body,
                            })) : (_jsx("span", { className: "ck-source-row", children: body })) }, c.id));
                    }) }) })] }));
}
export const defaultRenderCitation = ({ ids, citations, className }) => (_jsx("sup", { className: className, title: ids
        .map((id) => `${id} — ${citations[id].label}\n${citations[id].detail}`)
        .join("\n\n"), children: ids.join(" ") }));
function Inline({ spans, citations, renderLink, renderCitation, }) {
    return (_jsx(_Fragment, { children: spans.map((s, i) => {
            switch (s.kind) {
                case "code":
                    return (_jsx("code", { className: "ck-code", children: s.text }, i));
                case "strong":
                case "em": {
                    // Plain emphasis stays plain markup; only what holds a link, code
                    // or a citation is rendered as nested spans.
                    const plain = s.children.every((c) => c.kind === "text");
                    const inner = plain ? (s.text) : (_jsx(Inline, { spans: s.children, citations: citations, renderLink: renderLink, renderCitation: renderCitation }));
                    return s.kind === "strong" ? (_jsx("strong", { children: inner }, i)) : (_jsx("em", { children: inner }, i));
                }
                case "link":
                    return (_jsx("span", { children: renderLink({
                            href: s.href,
                            internal: isInternalHref(s.href),
                            className: "ck-link",
                            children: s.text,
                        }) }, i));
                case "image":
                    return _jsx("img", { className: "ck-img", src: s.src, alt: s.alt, loading: "lazy" }, i);
                case "cite": {
                    const known = s.ids.filter((id) => citations?.[id]);
                    if (known.length === 0 || !citations)
                        return null;
                    return (_jsx("span", { children: renderCitation({ ids: known, citations, className: "ck-cite" }) }, i));
                }
                default:
                    return _jsx("span", { children: s.text }, i);
            }
        }) }));
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
export function Markdown({ text, citations, renderLink = defaultRenderLink, renderCitation = defaultRenderCitation, renderSources, sources = true, sourcesLabel = "Sources", className, }) {
    const inline = (t) => (_jsx(Inline, { spans: parseInline(t), citations: citations, renderLink: renderLink, renderCitation: renderCitation }));
    const items = (list, ordered, start = 1) => {
        const List = ordered ? "ol" : "ul";
        return (_jsx(List, { start: ordered && start !== 1 ? start : undefined, children: list.map((item, j) => (_jsxs("li", { className: item.task !== undefined ? "ck-task" : undefined, children: [item.task !== undefined && (_jsx("input", { type: "checkbox", checked: item.task, readOnly: true, "aria-hidden": true, tabIndex: -1 })), inline(item.text), item.children && items(item.children, false)] }, j))) }));
    };
    const cards = (list, ordered, start = 1) => (_jsx("ol", { className: ordered ? "ck-cards ck-cards-numbered" : "ck-cards", children: list.map((item, j) => {
            const lead = listLead(item.text);
            return (_jsxs("li", { className: "ck-card", children: [_jsx("span", { className: lead.icon ? "ck-card-badge ck-card-icon" : "ck-card-badge", "aria-hidden": true, children: lead.icon ?? (ordered ? start + j : "•") }), _jsxs("div", { className: "ck-card-body", children: [_jsx("div", { className: "ck-card-title", children: inline(lead.lead) }), lead.rest && _jsx("div", { className: "ck-card-text", children: inline(lead.rest) }), item.children && items(item.children, false)] })] }, j));
        }) }));
    const cited = citations ? citedIds(text).filter((id) => citations[id]) : [];
    return (_jsxs("div", { className: className ? `ck-md ${className}` : "ck-md", children: [parseBlocks(text).map((b, i) => {
                switch (b.kind) {
                    case "code":
                        return (_jsx("pre", { className: "ck-pre", "data-lang": b.lang || undefined, children: _jsx("code", { children: b.code }) }, i));
                    case "ul":
                        return (_jsx("div", { children: isCardList(b.items) ? cards(b.items, false) : items(b.items, false) }, i));
                    case "ol":
                        return (_jsx("div", { children: isCardList(b.items)
                                ? cards(b.items, true, b.start)
                                : items(b.items, true, b.start) }, i));
                    case "h": {
                        const H = b.level === 1 ? "h2" : b.level === 2 ? "h3" : "h4";
                        return (_jsx(H, { className: `ck-md-h ck-md-h${b.level}`, children: inline(b.text) }, i));
                    }
                    case "quote":
                        return (_jsx("blockquote", { children: b.text.split("\n").map((line, j) => (_jsx("p", { children: inline(line) }, j))) }, i));
                    case "table":
                        return (_jsx("div", { className: "ck-table-wrap", children: _jsxs("table", { className: "ck-table", children: [_jsx("thead", { children: _jsx("tr", { children: b.head.map((cell, j) => (_jsx("th", { children: inline(cell) }, j))) }) }), _jsx("tbody", { children: b.rows.map((row, j) => (_jsx("tr", { children: b.head.map((_, k) => (_jsx("td", { children: inline(row[k] ?? "") }, k))) }, j))) })] }) }, i));
                    case "hr":
                        return _jsx("hr", { className: "ck-hr" }, i);
                    default:
                        return _jsx("p", { children: inline(b.text) }, i);
                }
            }), sources && cited.length > 0 && citations && renderSources ? (renderSources({
                records: cited.map((id) => ({ id, ...citations[id] })),
                label: sourcesLabel,
            })) : sources && cited.length > 0 && citations ? (_jsx(SourcesRow, { records: cited.map((id) => ({ id, ...citations[id] })), label: sourcesLabel, renderLink: renderLink })) : null] }));
}
//# sourceMappingURL=Markdown.js.map