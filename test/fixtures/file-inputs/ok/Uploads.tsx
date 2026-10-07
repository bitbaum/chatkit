export const A = () => <input type="file" accept="image/*" />;
export const B = () => <input type="file" accept=".jpg,.png,image/webp" />;
export const C = () => <input type="file" accept="audio/*,.mp3,.m4a,.webm" />;
export const D = () => <input type="file" accept=".txt,.md,.pdf" />;
// chatkit-allow-mixed-accept: desktop-only import dialog, never on a phone
export const E = () => <input type="file" accept="image/*,.csv" />;
