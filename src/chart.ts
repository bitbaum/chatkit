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

export type ChartPoint = {
  /** A year, a date or a number along the x axis. */
  x: string | number;
  y: number;
  href?: string;
  note?: string;
};
export type ChartSeries = { id: string; label: string; points: ChartPoint[] };
export type ChartRow = {
  label: string;
  value: number;
  href?: string;
  /** Percent of the whole, 0–100. */
  share?: number;
  note?: string;
  estimated?: boolean;
};
export type ShareRow = { label: string; share: number; href?: string };
export type ChartEvent = {
  date: string;
  label: string;
  href?: string;
  tone?: "up" | "down" | "neutral";
  kind?: string;
};
export type ChartTile = { label: string; value: string | number; href?: string; note?: string };

/** One of chartkit's five figures, as data. */
export type ChartBlock =
  | { type: "chart"; chart: "line"; caption: string; unit?: string; series: ChartSeries[] }
  | {
      type: "chart";
      chart: "bars";
      caption: string;
      unit?: string;
      rows: ChartRow[];
      /** The label of the row to draw in the accent (the reader's country, the answer). */
      highlight?: string;
    }
  | {
      type: "chart";
      chart: "share";
      caption: string;
      rows: ShareRow[];
      /** The share left over, 0–100, drawn as "Other". */
      other?: number;
    }
  | { type: "chart"; chart: "timeline"; caption: string; events: ChartEvent[] }
  | { type: "chart"; chart: "tiles"; caption: string; tiles: ChartTile[] };

export type ChartKind = ChartBlock["chart"];
export const CHART_KINDS = ["line", "bars", "share", "timeline", "tiles"] as const;

const record = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);
const str = (v: unknown, max: number): v is string =>
  typeof v === "string" && !!v.trim() && v.length <= max;
const num = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const list = (v: unknown, max: number): v is unknown[] =>
  Array.isArray(v) && v.length > 0 && v.length <= max;
const opt = <T>(v: unknown, ok: (v: unknown) => v is T) => v === undefined || ok(v);
const label = (v: unknown) => str(v, 120);
const note = (v: unknown) => opt(v, (x): x is string => str(x, 300));

/** Same-origin paths and web URLs only; a link in a chart is a link, never markup. */
export function safeChartHref(value: unknown): value is string {
  if (!str(value, 2048) || /[\s\\]/.test(value) || [...value].some((c) => c.charCodeAt(0) < 32))
    return false;
  if (/^\/(?!\/)/.test(value)) return true;
  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol) && !url.username && !url.password;
  } catch {
    return false;
  }
}
const href = (v: unknown) => opt(v, safeChartHref);

/**
 * A chart block, validated field by field against chartkit's shapes: bounded
 * lists, finite numbers, safe links. Anything else is null — the caller then
 * degrades it with `chartFallback` rather than dropping it.
 */
export function parseChartBlock(b: unknown): ChartBlock | null {
  if (!record(b) || b.type !== "chart" || !str(b.caption, 300)) return null;
  if (!opt(b.unit, (v): v is string => str(v, 20))) return null;
  switch (b.chart) {
    case "bars":
      return list(b.rows, 24) &&
        b.rows.every(
          (r) =>
            record(r) &&
            label(r.label) &&
            num(r.value) &&
            href(r.href) &&
            opt(r.share, (v): v is number => num(v) && v >= 0 && v <= 100) &&
            note(r.note) &&
            opt(r.estimated, (v): v is boolean => typeof v === "boolean"),
        ) &&
        opt(b.highlight, label)
        ? (b as ChartBlock)
        : null;
    case "share":
      return list(b.rows, 24) &&
        b.rows.every(
          (r) =>
            record(r) &&
            label(r.label) &&
            num(r.share) &&
            r.share >= 0 &&
            r.share <= 100 &&
            href(r.href),
        ) &&
        opt(b.other, (v): v is number => num(v) && v >= 0 && v <= 100)
        ? (b as ChartBlock)
        : null;
    case "line": {
      if (
        !list(b.series, 6) ||
        !b.series.every(
          (s) =>
            record(s) &&
            str(s.id, 50) &&
            label(s.label) &&
            list(s.points, 120) &&
            s.points.every(
              (p) =>
                record(p) && (num(p.x) || str(p.x, 40)) && num(p.y) && href(p.href) && note(p.note),
            ),
        )
      )
        return null;
      const ids = new Set(b.series.map((s) => (s as Record<string, unknown>).id));
      return ids.size === b.series.length ? (b as ChartBlock) : null;
    }
    case "timeline":
      return list(b.events, 24) &&
        b.events.every(
          (e) =>
            record(e) &&
            str(e.date, 40) &&
            label(e.label) &&
            href(e.href) &&
            opt(e.tone, (v): v is string => v === "up" || v === "down" || v === "neutral") &&
            opt(e.kind, (v): v is string => str(v, 40)),
        )
        ? (b as ChartBlock)
        : null;
    case "tiles":
      return list(b.tiles, 6) &&
        b.tiles.every(
          (t) =>
            record(t) &&
            label(t.label) &&
            (num(t.value) || str(t.value, 40)) &&
            href(t.href) &&
            note(t.note),
        )
        ? (b as ChartBlock)
        : null;
    default:
      return null;
  }
}

/** The data of a chart as a table: what chatkit draws without a renderer,
 *  and what Copy and Listen read. */
export type ChartTable = {
  caption: string;
  head: string[];
  rows: { cells: string[]; href?: string }[];
};

const fmt = (v: unknown, unit?: string) =>
  typeof v === "number"
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
export function chartFallback(raw: string | unknown): ChartTable | null {
  let b: unknown = raw;
  if (typeof raw === "string") {
    if (raw.length > 40000) return null;
    try {
      b = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (!record(b) || b.type !== "chart" || !str(b.caption, 300)) return null;
  const unit = str(b.unit, 20) ? b.unit : undefined;
  const caption = b.caption;
  const rows: ChartTable["rows"] = [];
  const link = (r: Record<string, unknown>) => (safeChartHref(r.href) ? r.href : undefined);
  const take = (v: unknown, max: number) =>
    (Array.isArray(v) ? v : []).slice(0, max).filter(record);
  if (b.chart === "line") {
    // x is a label, never a grouped number: 2014 is a year, not "2,014".
    let years = true;
    for (const s of take(b.series, 6)) {
      if (!label(s.label)) continue;
      for (const p of take(s.points, 120)) {
        if (!(num(p.x) || str(p.x, 40)) || !num(p.y)) continue;
        years &&= num(p.x) && Number.isInteger(p.x) && p.x >= 1000 && p.x <= 2999;
        rows.push({ cells: [s.label, String(p.x), fmt(p.y, unit)], href: link(p) });
      }
    }
    const x = years && rows.length > 0 ? "Year" : "x";
    return { caption, head: ["Series", x, unit ? `Value (${unit})` : "Value"], rows };
  }
  if (b.chart === "timeline") {
    for (const e of take(b.events, 24)) {
      if (!str(e.date, 40) || !label(e.label)) continue;
      rows.push({ cells: [e.date, e.label], href: link(e) });
    }
    return { caption, head: ["Date", "Event"], rows };
  }
  if (b.chart === "tiles") {
    for (const t of take(b.tiles, 6)) {
      if (!label(t.label) || !(num(t.value) || str(t.value, 40))) continue;
      rows.push({ cells: [t.label, fmt(t.value), str(t.note, 300) ? t.note : ""], href: link(t) });
    }
    const noted = rows.some((r) => r.cells[2]);
    if (!noted) for (const r of rows) r.cells.pop();
    return { caption, head: noted ? ["", "Value", "Note"] : ["", "Value"], rows };
  }
  if (b.chart === "share") {
    for (const r of take(b.rows, 24)) {
      if (!label(r.label) || !num(r.share)) continue;
      rows.push({ cells: [r.label, `${fmt(r.share)} %`], href: link(r) });
    }
    if (num(b.other)) rows.push({ cells: ["Other", `${fmt(b.other)} %`] });
    return { caption, head: ["", "Share"], rows };
  }
  // bars, and any chart kind chatkit does not know: label, value, share.
  const shared = take(b.rows, 24).some((r) => num(r.share));
  for (const r of take(b.rows, 24)) {
    if (!label(r.label) || !num(r.value)) continue;
    const cells = [r.label, `${fmt(r.value, unit)}${r.estimated === true ? " (est.)" : ""}`];
    if (shared) cells.push(num(r.share) ? `${fmt(r.share)} %` : "");
    rows.push({ cells, href: link(r) });
  }
  const head = ["", unit ? `Value (${unit})` : "Value"];
  if (shared) head.push("Share");
  return { caption, head, rows };
}

/** Copy, share and voice get the figures as lines, never the wire JSON. */
export function chartText(block: ChartBlock): string {
  const t = chartFallback(block);
  if (!t) return "";
  return `${t.caption}\n${t.rows.map((r) => r.cells.filter(Boolean).join(" — ")).join("\n")}`;
}
