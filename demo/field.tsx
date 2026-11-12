// The fixture behind demo/field.html and test/browser-field.mjs: DictationField
// (one line and many, with writing help) and CommentThread, the way an app
// would mount them. The "model" is a stub so the test is deterministic.
import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import { CommentThread, DictationField, type CommentItem } from "../src/react/index.js";

const SEED: CommentItem[] = [
  { id: "c1", author: "Ana", body: "First!", createdAt: "2026-11-05T10:00:00Z" },
  {
    id: "c2",
    author: "Ben",
    body: "A longer one\nwith a break.",
    createdAt: "2026-11-05T11:30:00Z",
  },
];

function Fixture() {
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  let n = 100;
  return (
    <div style={{ display: "grid", gap: 24, maxWidth: 640, margin: "0 auto", padding: 16 }}>
      <DictationField
        label="Title"
        value={title}
        onValueChange={setTitle}
        multiline={false}
        placeholder="Say it in one line"
        voice={{ transcribeUrl: "/api/transcribe" }}
      />
      <DictationField
        label="Note"
        value={note}
        onValueChange={setNote}
        placeholder="Write, or press the microphone"
        voice={{ transcribeUrl: "/api/transcribe" }}
        hint={<span data-testid="count">{note.length} characters</span>}
        improve={{
          suggestions: ["Make it tighter", "Fix the grammar"],
          run: async (text, instruction) => {
            await new Promise((r) => setTimeout(r, 60));
            if (/fail/i.test(instruction)) return null;
            return `${text} [${instruction}]`;
          },
        }}
      />
      <CommentThread
        comments={SEED}
        viewer={{ name: "Cy" }}
        voice={{ transcribeUrl: "/api/transcribe" }}
        canRemove={(c) => c.author === "Cy"}
        transport={{
          post: async (text) => {
            if (text.includes("boom")) throw new Error("refused");
            return {
              id: `c${n++}`,
              author: "Cy",
              body: text,
              createdAt: new Date("2026-11-05T12:00:00Z"),
            };
          },
          remove: async (id) => {
            if (id === "c-never") throw new Error("refused");
          },
        }}
      />
      <CommentThread
        comments={[]}
        viewer={null}
        signInHref="/sign-in"
        transport={{ post: async () => SEED[0]! }}
      />
    </div>
  );
}

// The form fixture behind demo/field-form.html: DictationField the way a form
// uses it — an inline editor that saves on blur and submits on Cmd/Ctrl+Enter,
// a one-line title with a name and an error, inside a native <form>. Every
// callback writes to window.__log so the browser test can count them.
declare global {
  interface Window {
    __log: string[];
    __suppressEnter?: boolean;
  }
}
window.__log = [];
const log = (entry: string) => window.__log.push(entry);

function FormFixture() {
  const [note, setNote] = useState("");
  const [title, setTitle] = useState("");
  const [tried, setTried] = useState(false);
  return (
    <div style={{ display: "grid", gap: 24, maxWidth: 640, margin: "0 auto", padding: 16 }}>
      <DictationField
        label="Note"
        id="note"
        value={note}
        onValueChange={setNote}
        voice={{ transcribeUrl: "/api/transcribe" }}
        improve={{ suggestions: ["Make it tighter"], run: async (t) => t }}
        onFocus={() => log("focus:note")}
        onBlur={() => log(`blur:note:${note}`)}
        onSubmit={() => log(`submit:note:${note}`)}
        onKeyDown={(e) => {
          if (e.key === "Escape") log("cancel:note");
          if (window.__suppressEnter && e.key === "Enter") e.preventDefault();
        }}
      />
      <form
        id="native"
        onSubmit={(e) => {
          e.preventDefault();
          log("native-submit");
        }}
      >
        <DictationField
          label="Title"
          id="title"
          name="title"
          multiline={false}
          value={title}
          onValueChange={setTitle}
          voice={{ transcribeUrl: "/api/transcribe" }}
          hint="One line, said or typed."
          error={tried && !title.trim() ? "A title is needed before this can be saved." : null}
          onSubmit={() => {
            setTried(true);
            log(`submit:title:${title}`);
          }}
          inputProps={{ autoComplete: "off", "data-testid": "title" }}
        />
      </form>
      <button type="button" id="elsewhere" style={{ minHeight: 44 }}>
        Elsewhere
      </button>
    </div>
  );
}

export function mountFieldFixture() {
  const el = document.getElementById("field-fixture");
  if (el) createRoot(el).render(<Fixture />);
  const form = document.getElementById("form-fixture");
  // Strict Mode on purpose: the document listeners must clean up, and a held
  // blur must not be reported twice.
  if (form)
    createRoot(form).render(
      <StrictMode>
        <FormFixture />
      </StrictMode>,
    );
}
