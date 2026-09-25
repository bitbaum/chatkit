import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * The handful of icons a chat needs, inline — so installing chatkit never
 * drags an icon library into an app that uses a different one. Paths follow
 * Lucide (ISC), stroke = currentColor, so they take the button's colour.
 */
function Svg(props) {
    return (_jsx("svg", { viewBox: "0 0 24 24", width: "1em", height: "1em", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true", focusable: "false", ...props }));
}
export const IconArrowUp = () => (_jsxs(Svg, { children: [_jsx("path", { d: "m5 12 7-7 7 7" }), _jsx("path", { d: "M12 19V5" })] }));
export const IconArrowDown = () => (_jsxs(Svg, { children: [_jsx("path", { d: "M12 5v14" }), _jsx("path", { d: "m19 12-7 7-7-7" })] }));
export const IconMic = () => (_jsxs(Svg, { children: [_jsx("path", { d: "M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" }), _jsx("path", { d: "M19 10v2a7 7 0 0 1-14 0v-2" }), _jsx("path", { d: "M12 19v3" })] }));
export const IconCheck = () => (_jsx(Svg, { children: _jsx("path", { d: "M20 6 9 17l-5-5" }) }));
export const IconX = () => (_jsxs(Svg, { children: [_jsx("path", { d: "M18 6 6 18" }), _jsx("path", { d: "m6 6 12 12" })] }));
export const IconStop = () => (_jsx(Svg, { fill: "currentColor", stroke: "none", children: _jsx("rect", { x: "6", y: "6", width: "12", height: "12", rx: "2" }) }));
export const IconSpinner = () => (_jsx(Svg, { className: "ck-spin", children: _jsx("path", { d: "M21 12a9 9 0 1 1-6.219-8.56" }) }));
export const IconCopy = () => (_jsxs(Svg, { children: [_jsx("rect", { width: "14", height: "14", x: "8", y: "8", rx: "2" }), _jsx("path", { d: "M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" })] }));
export const IconRetry = () => (_jsxs(Svg, { children: [_jsx("path", { d: "M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" }), _jsx("path", { d: "M3 3v5h5" })] }));
export const IconPaperclip = () => (_jsx(Svg, { children: _jsx("path", { d: "m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48" }) }));
export const IconFile = () => (_jsxs(Svg, { children: [_jsx("path", { d: "M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" }), _jsx("path", { d: "M14 2v4a2 2 0 0 0 2 2h4" })] }));
//# sourceMappingURL=icons.js.map