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
export const IconCamera = () => (_jsxs(Svg, { children: [_jsx("path", { d: "M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" }), _jsx("circle", { cx: "12", cy: "13", r: "3" })] }));
export const IconImage = () => (_jsxs(Svg, { children: [_jsx("rect", { width: "18", height: "18", x: "3", y: "3", rx: "2", ry: "2" }), _jsx("circle", { cx: "9", cy: "9", r: "2" }), _jsx("path", { d: "m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" })] }));
export const IconFileUp = () => (_jsxs(Svg, { children: [_jsx("path", { d: "M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" }), _jsx("path", { d: "M14 2v4a2 2 0 0 0 2 2h4" }), _jsx("path", { d: "M12 12v6" }), _jsx("path", { d: "m15 15-3-3-3 3" })] }));
export const IconShare = () => (_jsxs(Svg, { children: [_jsx("circle", { cx: "18", cy: "5", r: "3" }), _jsx("circle", { cx: "6", cy: "12", r: "3" }), _jsx("circle", { cx: "18", cy: "19", r: "3" }), _jsx("path", { d: "m8.59 13.51 6.82 3.98" }), _jsx("path", { d: "m15.41 6.51-6.82 3.98" })] }));
export const IconSpeaker = () => (_jsxs(Svg, { children: [_jsx("path", { d: "M11 4.702a.705.705 0 0 0-1.203-.498L6.413 7.587A1.4 1.4 0 0 1 5.416 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.416a1.4 1.4 0 0 1 .997.413l3.383 3.384A.705.705 0 0 0 11 19.298z" }), _jsx("path", { d: "M16 9a5 5 0 0 1 0 6" }), _jsx("path", { d: "M19.364 18.364a9 9 0 0 0 0-12.728" })] }));
export const IconBook = () => (_jsxs(Svg, { children: [_jsx("path", { d: "M12 7v14" }), _jsx("path", { d: "M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z" })] }));
/* The icons a stack tile may carry (rich.ts STACK_ICONS), by name. */
export const STACK_ICON_PATHS = {
    agent: ["M12 8V4H8", "M4 8h16v12H4z", "M2 14h2", "M20 14h2", "M15 13v2", "M9 13v2"],
    people: [
        "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2",
        "M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z",
        "M22 21v-2a4 4 0 0 0-3-3.87",
        "M16 3.13a4 4 0 0 1 0 7.75",
    ],
    robot: [
        "M12 8V2",
        "M9 2h6",
        "M5 8h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-9a2 2 0 0 1 2-2z",
        "M9 13h.01",
        "M15 13h.01",
        "M9 17h6",
    ],
    person: ["M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2", "M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z"],
    building: [
        "M3 21h18",
        "M5 21V7l7-4 7 4v14",
        "M9 9h1",
        "M14 9h1",
        "M9 13h1",
        "M14 13h1",
        "M10 21v-4h4v4",
    ],
    money: ["M2 7h20v10H2z", "M12 12a2 2 0 1 0 0-4 2 2 0 0 0 0 4z", "M6 12h.01", "M18 12h.01"],
    document: [
        "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z",
        "M14 2v6h6",
        "M8 13h8",
        "M8 17h8",
    ],
    code: ["m16 18 6-6-6-6", "m8 6-6 6 6 6"],
    check: ["M22 11.08V12a10 10 0 1 1-5.93-9.14", "m9 11 3 3L22 4"],
    globe: [
        "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z",
        "M2 12h20",
        "M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z",
    ],
    wrench: [
        "M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z",
    ],
    box: [
        "M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z",
        "m3.3 7 8.7 5 8.7-5",
        "M12 22V12",
    ],
    chat: ["M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"],
    flag: ["M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z", "M4 22v-7"],
};
export const StackIconSvg = ({ name }) => {
    const paths = STACK_ICON_PATHS[name];
    if (!paths)
        return null;
    return (_jsx(Svg, { className: "ck-stack-icon", children: paths.map((d, i) => (_jsx("path", { d: d }, i))) }));
};
export const IconChevron = () => (_jsx(Svg, { children: _jsx("path", { d: "m9 18 6-6-6-6" }) }));
export const IconThumbUp = () => (_jsxs(Svg, { children: [_jsx("path", { d: "M7 10v12" }), _jsx("path", { d: "M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z" })] }));
export const IconThumbDown = () => (_jsxs(Svg, { children: [_jsx("path", { d: "M17 14V2" }), _jsx("path", { d: "M9 18.12 10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.76a2 2 0 0 0-1.79 1.11L12 22a3.13 3.13 0 0 1-3-3.88Z" })] }));
// ChatApp's header and chat list.
export const IconMenu = () => (_jsxs(Svg, { children: [_jsx("path", { d: "M4 6h16" }), _jsx("path", { d: "M4 12h16" }), _jsx("path", { d: "M4 18h10" })] }));
export const IconNewChat = () => (_jsxs(Svg, { children: [_jsx("path", { d: "M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" }), _jsx("path", { d: "M18.375 2.625a1 1 0 0 1 3 3l-9.013 9.014a2 2 0 0 1-.853.505l-2.873.84a.5.5 0 0 1-.62-.62l.84-2.873a2 2 0 0 1 .506-.852z" })] }));
export const IconMore = () => (_jsxs(Svg, { children: [_jsx("circle", { cx: "5", cy: "12", r: "1" }), _jsx("circle", { cx: "12", cy: "12", r: "1" }), _jsx("circle", { cx: "19", cy: "12", r: "1" })] }));
export const IconGhost = () => (_jsxs(Svg, { children: [_jsx("path", { d: "M9 10h.01" }), _jsx("path", { d: "M15 10h.01" }), _jsx("path", { d: "M12 2a8 8 0 0 0-8 8v12l3-3 2.5 2.5L12 19l2.5 2.5L17 19l3 3V10a8 8 0 0 0-8-8z" })] }));
export const IconTrash = () => (_jsxs(Svg, { children: [_jsx("path", { d: "M3 6h18" }), _jsx("path", { d: "M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" }), _jsx("path", { d: "M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" })] }));
export const IconSearch = () => (_jsxs(Svg, { children: [_jsx("circle", { cx: "11", cy: "11", r: "8" }), _jsx("path", { d: "m21 21-4.3-4.3" })] }));
export const IconPencil = () => (_jsx(Svg, { children: _jsx("path", { d: "M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z" }) }));
//# sourceMappingURL=icons.js.map