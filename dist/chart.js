/**
 * Charts in answers (0.15). chatkit defines the DATA contract and a renderer
 * slot; the drawing is injected by the app (`renderers={{ chart }}` on
 * `ChatThread`, `ChatScreen`, `ChatMessage`, `Markdown` or `RichAnswerBlock`).
 * Substrata hands the block to `@bitbaum/chartkit`; the shapes here mirror
 * chartkit's props exactly, so a block spreads into the matching component:
 *
 *   chart: (b) => b.chart === "bars" ? <BarChart {...b} /> : …
 *
 * Without a renderer, or when one returns null, chatkit draws the caption and
 * a table of the data itself — a chart is never a blank.
 */
export const CHART_KINDS = ["line", "bars", "share", "timeline", "tiles"];
const record = (v) => !!v && typeof v === "object" && !Array.isArray(v);
const str = (v, max) => typeof v === "string" && !!v.trim() && v.length <= max;
const num = (v) => typeof v === "number" && Number.isFinite(v);
const list = (v, max) => Array.isArray(v) && v.length > 0 && v.length <= max;
const opt = (v, ok) => v === undefined || ok(v);
const label = (v) => str(v, 120);
const note = (v) => opt(v, (x) => str(x, 300));
/** Same-origin paths and web URLs only; a link in a chart is a link, never markup. */
export function safeChartHref(value) {
    if (!str(value, 2048) || /[\s\\]/.test(value) || [...value].some((c) => c.charCodeAt(0) < 32))
        return false;
    if (/^\/(?!\/)/.test(value))
        return true;
    try {
        const url = new URL(value);
        return ["https:", "http:"].includes(url.protocol) && !url.username && !url.password;
    }
    catch {
        return false;
    }
}
const href = (v) => opt(v, safeChartHref);
/**
 * A chart block, validated field by field against chartkit's shapes: bounded
 * lists, finite numbers, safe links. Anything else is null — the caller then
 * degrades it with `chartFallback` rather than dropping it.
 */
export function parseChartBlock(b) {
    if (!record(b) || b.type !== "chart" || !str(b.caption, 300))
        return null;
    if (!opt(b.unit, (v) => str(v, 20)))
        return null;
    switch (b.chart) {
        case "bars":
            return list(b.rows, 24) &&
                b.rows.every((r) => record(r) &&
                    label(r.label) &&
                    num(r.value) &&
                    href(r.href) &&
                    opt(r.share, (v) => num(v) && v >= 0 && v <= 100) &&
                    note(r.note) &&
                    opt(r.estimated, (v) => typeof v === "boolean")) &&
                opt(b.highlight, label)
                ? b
                : null;
        case "share":
            return list(b.rows, 24) &&
                b.rows.every((r) => record(r) &&
                    label(r.label) &&
                    num(r.share) &&
                    r.share >= 0 &&
                    r.share <= 100 &&
                    href(r.href)) &&
                opt(b.other, (v) => num(v) && v >= 0 && v <= 100)
                ? b
                : null;
        case "line": {
            if (!list(b.series, 6) ||
                !b.series.every((s) => record(s) &&
                    str(s.id, 50) &&
                    label(s.label) &&
                    list(s.points, 120) &&
                    s.points.every((p) => record(p) && (num(p.x) || str(p.x, 40)) && num(p.y) && href(p.href) && note(p.note))))
                return null;
            const ids = new Set(b.series.map((s) => s.id));
            return ids.size === b.series.length ? b : null;
        }
        case "timeline":
            return list(b.events, 24) &&
                b.events.every((e) => record(e) &&
                    str(e.date, 40) &&
                    label(e.label) &&
                    href(e.href) &&
                    opt(e.tone, (v) => v === "up" || v === "down" || v === "neutral") &&
                    opt(e.kind, (v) => str(v, 40)))
                ? b
                : null;
        case "tiles":
            return list(b.tiles, 6) &&
                b.tiles.every((t) => record(t) &&
                    label(t.label) &&
                    (num(t.value) || str(t.value, 40)) &&
                    href(t.href) &&
                    note(t.note))
                ? b
                : null;
        default:
            return null;
    }
}
const fmt = (v, unit) => typeof v === "number"
    ? `${Number.isInteger(v) ? v.toLocaleString("en-US") : v.toLocaleString("en-US", { maximumFractionDigits: 2 })}${unit ? ` ${unit}` : ""}`
    : typeof v === "string"
        ? v
        : "";
/**
 * A table of whatever a chart block holds — valid or not. A malformed block
 * (a share of 140, a link with a script in it, forty rows) still has a caption
 * and some rows a reader can use, so the answer shows those instead of a hole.
 * Only the safe parts travel: string labels, finite numbers, safe links.
 * Partial JSON, or anything that is not a chart with a caption, is null.
 */
export function chartFallback(raw) {
    let b = raw;
    if (typeof raw === "string") {
        if (raw.length > 40000)
            return null;
        try {
            b = JSON.parse(raw);
        }
        catch {
            return null;
        }
    }
    if (!record(b) || b.type !== "chart" || !str(b.caption, 300))
        return null;
    const unit = str(b.unit, 20) ? b.unit : undefined;
    const caption = b.caption;
    const rows = [];
    const link = (r) => (safeChartHref(r.href) ? r.href : undefined);
    const take = (v, max) => (Array.isArray(v) ? v : []).slice(0, max).filter(record);
    if (b.chart === "line") {
        // x is a label, never a grouped number: 2014 is a year, not "2,014".
        let years = true;
        for (const s of take(b.series, 6)) {
            if (!label(s.label))
                continue;
            for (const p of take(s.points, 120)) {
                if (!(num(p.x) || str(p.x, 40)) || !num(p.y))
                    continue;
                years &&= num(p.x) && Number.isInteger(p.x) && p.x >= 1000 && p.x <= 2999;
                rows.push({ cells: [s.label, String(p.x), fmt(p.y, unit)], href: link(p) });
            }
        }
        const x = years && rows.length > 0 ? "Year" : "x";
        return { caption, head: ["Series", x, unit ? `Value (${unit})` : "Value"], rows };
    }
    if (b.chart === "timeline") {
        for (const e of take(b.events, 24)) {
            if (!str(e.date, 40) || !label(e.label))
                continue;
            rows.push({ cells: [e.date, e.label], href: link(e) });
        }
        return { caption, head: ["Date", "Event"], rows };
    }
    if (b.chart === "tiles") {
        for (const t of take(b.tiles, 6)) {
            if (!label(t.label) || !(num(t.value) || str(t.value, 40)))
                continue;
            rows.push({ cells: [t.label, fmt(t.value), str(t.note, 300) ? t.note : ""], href: link(t) });
        }
        const noted = rows.some((r) => r.cells[2]);
        if (!noted)
            for (const r of rows)
                r.cells.pop();
        return { caption, head: noted ? ["", "Value", "Note"] : ["", "Value"], rows };
    }
    if (b.chart === "share") {
        for (const r of take(b.rows, 24)) {
            if (!label(r.label) || !num(r.share))
                continue;
            rows.push({ cells: [r.label, `${fmt(r.share)} %`], href: link(r) });
        }
        if (num(b.other))
            rows.push({ cells: ["Other", `${fmt(b.other)} %`] });
        return { caption, head: ["", "Share"], rows };
    }
    // bars, and any chart kind chatkit does not know: label, value, share.
    const shared = take(b.rows, 24).some((r) => num(r.share));
    for (const r of take(b.rows, 24)) {
        if (!label(r.label) || !num(r.value))
            continue;
        const cells = [r.label, `${fmt(r.value, unit)}${r.estimated === true ? " (est.)" : ""}`];
        if (shared)
            cells.push(num(r.share) ? `${fmt(r.share)} %` : "");
        rows.push({ cells, href: link(r) });
    }
    const head = ["", unit ? `Value (${unit})` : "Value"];
    if (shared)
        head.push("Share");
    return { caption, head, rows };
}
/** Copy, share and voice get the figures as lines, never the wire JSON. */
export function chartText(block) {
    const t = chartFallback(block);
    if (!t)
        return "";
    return `${t.caption}\n${t.rows.map((r) => r.cells.filter(Boolean).join(" — ")).join("\n")}`;
}
//# sourceMappingURL=chart.js.map