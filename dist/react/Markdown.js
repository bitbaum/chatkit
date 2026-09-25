import { jsx as _jsx, Fragment as _Fragment } from "react/jsx-runtime";
import { isInternalHref, parseBlocks, parseInline } from "../markdown.js";
/** A plain anchor: same-site paths in place, everything else in a new tab. */
export const defaultRenderLink = ({ href, internal, className, children }) => internal ? (_jsx("a", { href: href, className: className, children: children })) : (_jsx("a", { href: href, className: className, target: "_blank", rel: "noopener noreferrer", children: children }));
function Inline({ spans, citations, renderLink, }) {
    return (_jsx(_Fragment, { children: spans.map((s, i) => {
            switch (s.kind) {
                case "code":
                    return (_jsx("code", { className: "ck-code", children: s.text }, i));
                case "strong":
                    return _jsx("strong", { children: s.text }, i);
                case "em":
                    return _jsx("em", { children: s.text }, i);
                case "link":
                    return (_jsx("span", { children: renderLink({
                            href: s.href,
                            internal: isInternalHref(s.href),
                            className: "ck-link",
                            children: s.text,
                        }) }, i));
                case "cite": {
                    const known = s.ids.filter((id) => citations?.[id]);
                    if (known.length === 0)
                        return null;
                    return (_jsx("sup", { className: "ck-cite", title: known
                            .map((id) => `${id} — ${citations[id].label}\n${citations[id].detail}`)
                            .join("\n\n"), children: known.join(" ") }, i));
                }
                default:
                    return _jsx("span", { children: s.text }, i);
            }
        }) }));
}
/**
 * Model output as readable text: paragraphs, lists, headings, bold, italic,
 * code, links and citations. Never HTML — nothing here can inject markup.
 */
export function Markdown({ text, citations, renderLink = defaultRenderLink, className, }) {
    const inline = (t) => (_jsx(Inline, { spans: parseInline(t), citations: citations, renderLink: renderLink }));
    return (_jsx("div", { className: className ? `ck-md ${className}` : "ck-md", children: parseBlocks(text).map((b, i) => {
            switch (b.kind) {
                case "code":
                    return (_jsx("pre", { className: "ck-pre", "data-lang": b.lang || undefined, children: _jsx("code", { children: b.code }) }, i));
                case "ul":
                case "ol": {
                    const List = b.kind;
                    return (_jsx(List, { children: b.items.map((item, j) => (_jsx("li", { children: inline(item) }, j))) }, i));
                }
                case "h":
                    return (_jsx("p", { className: "ck-md-h", children: inline(b.text) }, i));
                case "quote":
                    return _jsx("blockquote", { children: inline(b.text) }, i);
                default:
                    return _jsx("p", { children: inline(b.text) }, i);
            }
        }) }));
}
//# sourceMappingURL=Markdown.js.map