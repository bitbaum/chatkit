/**
 * This file used to own a bare <input accept="image/*,text/*,.md">.
 */
// before: accept="image/*,.txt"
export const A = () => (
  <>
    {/* old: accept="audio/*,.txt" */}
    <input type="file" accept="image/*" /> {/* accept="image/*,.csv" */}
  </>
);
