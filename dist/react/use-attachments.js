"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { shrinkImage as shrink } from "../image.js";
import { DEFAULT_ATTACHMENT_LIMITS, DEFAULT_ATTACHMENT_NOTES, attachmentKey, isImageMime, isTextFile, stripDataUrlBase64, toWire, } from "../attachments.js";
/**
 * Staging screenshots and text files for a composer — paste-to-attach
 * included, because on a phone that is how a screenshot arrives. Preview URLs
 * are revoked on remove, clear and unmount (a preview never revoked is a leak
 * that survives every send). From loki `hooks/use-attachments.ts`.
 */
export function useAttachments(limits = {}, notes = {}) {
    const lim = { ...DEFAULT_ATTACHMENT_LIMITS, ...limits };
    const { maxFiles, maxImageBytes, maxTextChars, maxImageEdge } = lim;
    // Mirrored in a ref so a new `notes` object every render does not rebuild
    // every callback below.
    const say = useRef(DEFAULT_ATTACHMENT_NOTES);
    useEffect(() => {
        say.current = { ...DEFAULT_ATTACHMENT_NOTES, ...notes };
    });
    const [attachments, setAttachments] = useState([]);
    const [note, setNote] = useState(null);
    const previews = useRef(new Set());
    const count = useRef(0);
    useEffect(() => {
        count.current = attachments.length;
    }, [attachments.length]);
    useEffect(() => {
        const urls = previews.current;
        return () => {
            for (const url of urls)
                URL.revokeObjectURL(url);
            urls.clear();
        };
    }, []);
    const add = useCallback((item) => setAttachments((prev) => {
        if (prev.length >= maxFiles)
            return prev;
        if (prev.some((p) => attachmentKey(p) === attachmentKey(item)))
            return prev;
        return [...prev, item];
    }), [maxFiles]);
    const stageImage = useCallback((file) => {
        const name = file.name || "screenshot.png";
        if (!isImageMime(file.type)) {
            setNote(say.current.wrongType(name));
            return;
        }
        const tooLarge = () => setNote(say.current.imageTooLarge(name, Math.round(maxImageBytes / 1_000_000)));
        if (maxImageEdge > 0) {
            // Shrink first, then judge the size: a 4 MB screenshot is fine once it
            // is the 300 KB it needed to be.
            shrink(file, maxImageEdge, maxImageBytes)
                .then((dataUrl) => {
                if (!dataUrl) {
                    tooLarge();
                    return;
                }
                const previewUrl = URL.createObjectURL(file);
                previews.current.add(previewUrl);
                add({
                    kind: "image",
                    name: name.replace(/\.(png|gif|webp|jpe?g)$/i, "") + ".jpg",
                    mimeType: "image/jpeg",
                    dataBase64: stripDataUrlBase64(dataUrl),
                    previewUrl,
                });
            })
                .catch(() => setNote(say.current.unreadable(name)));
            return;
        }
        if (file.size > maxImageBytes) {
            tooLarge();
            return;
        }
        const reader = new FileReader();
        reader.onload = () => {
            const previewUrl = URL.createObjectURL(file);
            previews.current.add(previewUrl);
            add({
                kind: "image",
                name,
                mimeType: file.type,
                dataBase64: stripDataUrlBase64(String(reader.result ?? "")),
                previewUrl,
            });
        };
        reader.onerror = () => setNote(say.current.unreadable(name));
        reader.readAsDataURL(file);
    }, [add, maxImageBytes, maxImageEdge]);
    const stageText = useCallback((file) => {
        if (!isTextFile(file.name, file.type)) {
            setNote(say.current.wrongType(file.name));
            return;
        }
        if (file.size > maxTextChars) {
            setNote(say.current.textTooLarge(file.name, Math.round(maxTextChars / 1000)));
            return;
        }
        const reader = new FileReader();
        reader.onload = () => add({
            kind: "text",
            name: file.name,
            content: String(reader.result ?? "").slice(0, maxTextChars),
        });
        reader.onerror = () => setNote(say.current.unreadable(file.name));
        reader.readAsText(file);
    }, [add, maxTextChars]);
    const addFiles = useCallback((files) => {
        if (!files)
            return;
        setNote(null);
        const room = maxFiles - count.current;
        if (room <= 0) {
            setNote(say.current.tooMany(maxFiles));
            return;
        }
        for (const file of Array.from(files).slice(0, room)) {
            if (isImageMime(file.type))
                stageImage(file);
            else
                stageText(file);
        }
    }, [maxFiles, stageImage, stageText]);
    const addFromPaste = useCallback((e) => {
        const items = e.clipboardData?.items;
        if (!items)
            return false;
        const images = Array.from(items).filter((i) => i.type.startsWith("image/"));
        if (images.length === 0)
            return false;
        setNote(null);
        for (const item of images) {
            const file = item.getAsFile();
            if (file)
                stageImage(file);
        }
        return true;
    }, [stageImage]);
    const revoke = (a) => {
        if (!a.previewUrl)
            return;
        URL.revokeObjectURL(a.previewUrl);
        previews.current.delete(a.previewUrl);
    };
    const remove = useCallback((key) => {
        setAttachments((prev) => {
            const target = prev.find((a) => attachmentKey(a) === key);
            if (target)
                revoke(target);
            return prev.filter((a) => attachmentKey(a) !== key);
        });
    }, []);
    const clear = useCallback(() => {
        setAttachments((prev) => {
            prev.forEach(revoke);
            return [];
        });
        setNote(null);
    }, []);
    return {
        attachments,
        note,
        clearNote: () => setNote(null),
        addFiles,
        addFromPaste,
        remove,
        clear,
        toWire: () => toWire(attachments),
        keyOf: attachmentKey,
        full: attachments.length >= maxFiles,
        limits: lim,
    };
}
//# sourceMappingURL=use-attachments.js.map