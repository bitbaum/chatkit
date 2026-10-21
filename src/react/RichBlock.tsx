"use client";

import { useId, useState } from "react";
import type { RichBlock } from "../rich.js";
import { Sheet } from "./Sheet.js";

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
