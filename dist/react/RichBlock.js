"use client";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useId, useState } from "react";
import { Sheet } from "./Sheet.js";
import { StackIconSvg } from "./icons.js";
export function RichAnswerBlock({ block, onReply, }) {
    const id = useId();
    const [selected, setSelected] = useState(null);
    const [sent, setSent] = useState(false);
    const [photo, setPhoto] = useState(null);
    if (block.type === "audio")
        return (_jsxs("figure", { className: "ck-rich ck-audio", children: [_jsx("figcaption", { className: "ck-rich-title", children: block.title }), block.creator && _jsx("p", { children: block.creator }), _jsx("audio", { controls: true, preload: "none", src: block.src, "aria-label": block.title }), block.caption && _jsx("p", { children: block.caption }), _jsxs("a", { href: block.src, target: "_blank", rel: "noopener noreferrer", children: [block.title, " \u2197"] })] }));
    if (block.type === "gallery") {
        const active = photo === null ? null : block.images[photo];
        return (_jsxs("figure", { className: "ck-rich ck-gallery", children: [_jsx("figcaption", { className: "ck-rich-title", children: block.title }), _jsx("div", { className: "ck-gallery-grid", children: block.images.map((item, i) => (_jsxs("figure", { children: [_jsxs("button", { type: "button", className: "ck-photo", onClick: () => setPhoto(i), "aria-label": item.alt, "aria-haspopup": "dialog", children: [_jsx("img", { src: item.src, alt: item.alt, loading: "lazy", referrerPolicy: "no-referrer", onError: (e) => {
                                            e.currentTarget.hidden = true;
                                        } }), _jsx("span", { className: "ck-photo-label", children: item.alt })] }), item.caption && _jsx("figcaption", { children: item.caption })] }, i))) }), _jsxs(Sheet, { open: !!active, onClose: () => setPhoto(null), title: active?.alt ?? block.title, children: [active && (_jsx("img", { className: "ck-photo-full", src: active.src, alt: active.alt, referrerPolicy: "no-referrer" })), active?.caption && _jsx("p", { children: active.caption })] })] }));
    }
    if (block.type === "diagram")
        return (_jsxs("figure", { className: "ck-rich ck-diagram", children: [_jsx("figcaption", { className: "ck-rich-title", children: block.title }), _jsx("ol", { className: "ck-diagram-nodes", children: block.nodes.map((n, i) => (_jsxs("li", { children: [_jsx("span", { className: "ck-diagram-number", "aria-hidden": true, children: i + 1 }), _jsxs("div", { children: [_jsx("strong", { children: n.label }), n.detail && _jsx("p", { children: n.detail })] })] }, n.id))) }), block.edges.length > 0 && (_jsx("ul", { className: "ck-diagram-edges", children: block.edges.map((e, i) => (_jsxs("li", { children: [_jsx("span", { children: block.nodes.find((n) => n.id === e.from).label }), _jsx("span", { className: "ck-diagram-arrow", "aria-hidden": true, children: "\u2192" }), _jsx("span", { children: block.nodes.find((n) => n.id === e.to).label }), e.label && _jsx("small", { children: e.label })] }, i))) }))] }));
    if (block.type === "stack")
        return (_jsxs("figure", { className: "ck-rich ck-stack", children: [_jsx("figcaption", { className: "ck-rich-title", children: block.title }), _jsx("div", { className: "ck-stack-layers", children: block.layers.map((layer, i) => (_jsxs("div", { className: "ck-stack-layer", children: [_jsx("div", { className: "ck-stack-row", "data-n": layer.nodes.length, style: { "--ck-n": layer.nodes.length }, children: layer.nodes.map((n, j) => (_jsxs("div", { className: n.tone === "accent" ? "ck-stack-node ck-stack-accent" : "ck-stack-node", children: [n.icon && _jsx(StackIconSvg, { name: n.icon }), n.kicker && _jsx("span", { className: "ck-stack-kicker", children: n.kicker }), _jsx("strong", { className: "ck-stack-label", children: n.label }), n.detail && _jsx("span", { className: "ck-stack-detail", children: n.detail })] }, j))) }), i < block.layers.length - 1 && (_jsxs("div", { className: "ck-stack-link", children: [_jsx("span", { className: "ck-stack-arrow", "aria-hidden": true, children: layer.both ? "⇅" : "↓" }), layer.link && _jsx("span", { children: layer.link })] }))] }, i))) }), block.caption && _jsx("p", { className: "ck-stack-caption", children: block.caption })] }));
    if (block.type === "callout")
        return (_jsxs("aside", { className: "ck-rich ck-callout", children: [_jsx("strong", { className: "ck-rich-title", children: block.title }), _jsx("p", { children: block.body })] }));
    return (_jsx("form", { className: "ck-rich ck-choice", onSubmit: (e) => {
            e.preventDefault();
            if (selected !== null && onReply && !sent) {
                setSent(true);
                onReply(block.options[selected].reply);
            }
        }, children: _jsxs("fieldset", { disabled: !onReply || sent, children: [_jsx("legend", { className: "ck-rich-title", children: block.title }), block.options.map((option, i) => (_jsxs("label", { className: "ck-choice-option", children: [_jsx("input", { type: "radio", name: id, value: i, checked: selected === i, onChange: () => setSelected(i) }), _jsx("span", { children: option.label })] }, i))), onReply && (_jsxs("button", { type: "submit", className: "ck-choice-submit", disabled: selected === null || sent, children: [block.submit, _jsx("span", { "aria-hidden": true, children: "\u2192" })] }))] }) }));
}
//# sourceMappingURL=RichBlock.js.map