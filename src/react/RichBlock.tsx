"use client";

import { useId, useState, type CSSProperties } from "react";
import type { RichBlock } from "../rich.js";
import { Sheet } from "./Sheet.js";
import { StackIconSvg } from "./icons.js";

export function RichAnswerBlock({
  block,
  onReply,
}: {
  block: RichBlock;
  onReply?: (text: string) => void;
}) {
  const id = useId();
  const [selected, setSelected] = useState<number | null>(null);
  const [sent, setSent] = useState(false);
  const [photo, setPhoto] = useState<number | null>(null);
  if (block.type === "audio")
    return (
      <figure className="ck-rich ck-audio">
        <figcaption className="ck-rich-title">{block.title}</figcaption>
        {block.creator && <p>{block.creator}</p>}
        <audio controls preload="none" src={block.src} aria-label={block.title} />
        {block.caption && <p>{block.caption}</p>}
        <a href={block.src} target="_blank" rel="noopener noreferrer">
          {block.title} ↗
        </a>
      </figure>
    );
  if (block.type === "gallery") {
    const active = photo === null ? null : block.images[photo];
    return (
      <figure className="ck-rich ck-gallery">
        <figcaption className="ck-rich-title">{block.title}</figcaption>
        <div className="ck-gallery-grid">
          {block.images.map((item, i) => (
            <figure key={i}>
              <button
                type="button"
                className="ck-photo"
                onClick={() => setPhoto(i)}
                aria-label={item.alt}
                aria-haspopup="dialog"
              >
                <img
                  src={item.src}
                  alt={item.alt}
                  loading="lazy"
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    e.currentTarget.hidden = true;
                  }}
                />
                <span className="ck-photo-label">{item.alt}</span>
              </button>
              {item.caption && <figcaption>{item.caption}</figcaption>}
            </figure>
          ))}
        </div>
        <Sheet open={!!active} onClose={() => setPhoto(null)} title={active?.alt ?? block.title}>
          {active && (
            <img
              className="ck-photo-full"
              src={active.src}
              alt={active.alt}
              referrerPolicy="no-referrer"
            />
          )}
          {active?.caption && <p>{active.caption}</p>}
        </Sheet>
      </figure>
    );
  }
  if (block.type === "diagram")
    return (
      <figure className="ck-rich ck-diagram">
        <figcaption className="ck-rich-title">{block.title}</figcaption>
        <ol className="ck-diagram-nodes">
          {block.nodes.map((n, i) => (
            <li key={n.id}>
              <span className="ck-diagram-number" aria-hidden>
                {i + 1}
              </span>
              <div>
                <strong>{n.label}</strong>
                {n.detail && <p>{n.detail}</p>}
              </div>
            </li>
          ))}
        </ol>
        {block.edges.length > 0 && (
          <ul className="ck-diagram-edges">
            {block.edges.map((e, i) => (
              <li key={i}>
                <span>{block.nodes.find((n) => n.id === e.from)!.label}</span>
                <span className="ck-diagram-arrow" aria-hidden>
                  →
                </span>
                <span>{block.nodes.find((n) => n.id === e.to)!.label}</span>
                {e.label && <small>{e.label}</small>}
              </li>
            ))}
          </ul>
        )}
      </figure>
    );
  if (block.type === "stack")
    return (
      <figure className="ck-rich ck-stack">
        <figcaption className="ck-rich-title">{block.title}</figcaption>
        <div className="ck-stack-layers">
          {block.layers.map((layer, i) => (
            <div key={i} className="ck-stack-layer">
              <div
                className="ck-stack-row"
                data-n={layer.nodes.length}
                style={{ "--ck-n": layer.nodes.length } as CSSProperties}
              >
                {layer.nodes.map((n, j) => (
                  <div
                    key={j}
                    className={
                      n.tone === "accent" ? "ck-stack-node ck-stack-accent" : "ck-stack-node"
                    }
                  >
                    {n.icon && <StackIconSvg name={n.icon} />}
                    {n.kicker && <span className="ck-stack-kicker">{n.kicker}</span>}
                    <strong className="ck-stack-label">{n.label}</strong>
                    {n.detail && <span className="ck-stack-detail">{n.detail}</span>}
                  </div>
                ))}
              </div>
              {i < block.layers.length - 1 && (
                <div className="ck-stack-link">
                  <span className="ck-stack-arrow" aria-hidden>
                    {layer.both ? "⇅" : "↓"}
                  </span>
                  {layer.link && <span>{layer.link}</span>}
                </div>
              )}
            </div>
          ))}
        </div>
        {block.caption && <p className="ck-stack-caption">{block.caption}</p>}
      </figure>
    );
  if (block.type === "callout")
    return (
      <aside className="ck-rich ck-callout">
        <strong className="ck-rich-title">{block.title}</strong>
        <p>{block.body}</p>
      </aside>
    );
  return (
    <form
      className="ck-rich ck-choice"
      onSubmit={(e) => {
        e.preventDefault();
        if (selected !== null && onReply && !sent) {
          setSent(true);
          onReply(block.options[selected]!.reply);
        }
      }}
    >
      <fieldset disabled={!onReply || sent}>
        <legend className="ck-rich-title">{block.title}</legend>
        {block.options.map((option, i) => (
          <label key={i} className="ck-choice-option">
            <input
              type="radio"
              name={id}
              value={i}
              checked={selected === i}
              onChange={() => setSelected(i)}
            />
            <span>{option.label}</span>
          </label>
        ))}
        {onReply && (
          <button type="submit" className="ck-choice-submit" disabled={selected === null || sent}>
            {block.submit}
            <span aria-hidden>→</span>
          </button>
        )}
      </fieldset>
    </form>
  );
}
