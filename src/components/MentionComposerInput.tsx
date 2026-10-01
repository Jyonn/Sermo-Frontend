import { forwardRef, useImperativeHandle, useLayoutEffect, useRef } from "react";
import type { ClipboardEvent as ReactClipboardEvent, KeyboardEvent as ReactKeyboardEvent } from "react";

const MENTION_TOKEN_RE = /<@(\d+)>/g;
const ZERO_WIDTH = "\u200B";

export interface MentionComposerMember {
  userId: number;
  name: string;
}

export interface MentionComposerHandle {
  getElement: () => HTMLDivElement | null;
  focus: () => void;
  blur: () => void;
  insertMention: (member: MentionComposerMember) => void;
  insertText: (text: string) => void;
  openMentionPicker: () => void;
  insertTextWithoutFocus: (text: string) => void;
  moveCaretToEnd: () => void;
}

interface MentionComposerInputProps {
  className?: string;
  members: MentionComposerMember[];
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  onMentionQueryChange: (query: string | null) => void;
  onSelectFirstMention: () => boolean;
  onSubmit: () => void;
  onFocus?: () => void;
  onPaste?: (event: ReactClipboardEvent<HTMLDivElement>) => void;
}

function serializeNode(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return (node.textContent || "").split(ZERO_WIDTH).join("");
  if (!(node instanceof HTMLElement)) return "";
  if (node.dataset.mentionUserId) return `<@${node.dataset.mentionUserId}>`;
  if (node.tagName === "BR") return "\n";
  const text = Array.from(node.childNodes).map(serializeNode).join("");
  return node.tagName === "DIV" ? `${text}\n` : text;
}

function serializeEditor(element: HTMLElement) {
  return Array.from(element.childNodes).map(serializeNode).join("").replace(/\n$/, "");
}

function appendValue(element: HTMLElement, value: string, members: Map<number, string>) {
  element.replaceChildren();
  let lastIndex = 0;
  Array.from(value.matchAll(MENTION_TOKEN_RE)).forEach((match) => {
    const start = match.index ?? 0;
    if (start > lastIndex) element.append(document.createTextNode(value.slice(lastIndex, start)));
    const userId = Number(match[1]);
    const chip = document.createElement("span");
    chip.className = "composer-mention-chip";
    chip.contentEditable = "false";
    chip.dataset.mentionUserId = String(userId);
    chip.textContent = `@${members.get(userId) || userId}`;
    element.append(chip);
    element.append(document.createTextNode(ZERO_WIDTH));
    lastIndex = start + match[0].length;
  });
  if (lastIndex < value.length) element.append(document.createTextNode(value.slice(lastIndex)));
}

function placeCaretAfter(node: Node) {
  const selection = window.getSelection();
  if (!selection) return;
  const range = document.createRange();
  range.setStartAfter(node);
  range.collapse(true);
  selection.removeAllRanges();
  selection.addRange(range);
}

function mentionBeforeCaret(range: Range): HTMLElement | null {
  const container = range.startContainer;
  const offset = range.startOffset;
  if (container.nodeType === Node.TEXT_NODE && /[^\u200B]/u.test((container.textContent || "").slice(0, offset))) return null;
  let previous = container.nodeType === Node.TEXT_NODE
    ? container.previousSibling
    : container.childNodes[offset - 1];
  while (previous?.nodeType === Node.TEXT_NODE && !/[^\u200B]/u.test(previous.textContent || "")) {
    previous = previous.previousSibling;
  }
  return previous instanceof HTMLElement && previous.dataset.mentionUserId ? previous : null;
}

export const MentionComposerInput = forwardRef<MentionComposerHandle, MentionComposerInputProps>(function MentionComposerInput({
  className,
  members,
  placeholder,
  value,
  onChange,
  onMentionQueryChange,
  onSelectFirstMention,
  onSubmit,
  onFocus,
  onPaste,
}, forwardedRef) {
  const editorRef = useRef<HTMLDivElement | null>(null);
  const activeMentionRangeRef = useRef<Range | null>(null);
  const lastSelectionRangeRef = useRef<Range | null>(null);
  const armedChipRef = useRef<HTMLElement | null>(null);
  const memberNames = new Map(members.map((member) => [member.userId, member.name]));

  const debugMention = (stage: string, details: Record<string, unknown> = {}) => {
    if (typeof window === "undefined") return;
    try {
      if (window.localStorage.getItem("sermo:debug-mentions") !== "1") return;
    } catch {
      return;
    }
    const editor = editorRef.current;
    const selection = window.getSelection();
    const node = selection?.anchorNode;
    const offset = selection?.anchorOffset ?? -1;
    const previous = node?.nodeType === Node.TEXT_NODE ? node.previousSibling
      : node instanceof HTMLElement ? node.childNodes[offset - 1] : null;
    console.info("[mention]", stage, {
      focused: document.activeElement === editor,
      selectionInsideEditor: Boolean(editor && node && editor.contains(node)),
      nodeType: node?.nodeType ?? null,
      offset,
      textLength: node?.nodeType === Node.TEXT_NODE ? node.textContent?.length : null,
      charBeforeCodePoint: node?.nodeType === Node.TEXT_NODE && offset > 0 ? node.textContent?.codePointAt(offset - 1) : null,
      previousIsMention: previous instanceof HTMLElement && Boolean(previous.dataset.mentionUserId),
      chipCount: editor?.querySelectorAll("[data-mention-user-id]").length ?? 0,
      armed: Boolean(armedChipRef.current),
      ...details,
    });
  };

  const rememberSelection = () => {
    const editor = editorRef.current;
    const selection = window.getSelection();
    if (!editor || !selection?.rangeCount) return;
    const range = selection.getRangeAt(0);
    if (editor.contains(range.commonAncestorContainer)) lastSelectionRangeRef.current = range.cloneRange();
  };

  const updateMentionQuery = () => {
    const editor = editorRef.current;
    const selection = window.getSelection();
    if (!editor || !selection?.rangeCount || !selection.isCollapsed) {
      activeMentionRangeRef.current = null;
      onMentionQueryChange(null);
      return;
    }
    const range = selection.getRangeAt(0);
    rememberSelection();
    const node = range.startContainer;
    if (node.nodeType !== Node.TEXT_NODE) {
      activeMentionRangeRef.current = null;
      onMentionQueryChange(null);
      return;
    }
    const beforeCaret = (node.textContent || "").slice(0, range.startOffset).split(ZERO_WIDTH).join("");
    const match = beforeCaret.match(/(?:^|[\s，。！？、,.!?])@([^\s@]{0,32})$/u);
    if (!match) {
      activeMentionRangeRef.current = null;
      onMentionQueryChange(null);
      return;
    }
    const query = match[1];
    const mentionRange = document.createRange();
    mentionRange.setStart(node, range.startOffset - query.length - 1);
    mentionRange.setEnd(node, range.startOffset);
    activeMentionRangeRef.current = mentionRange;
    onMentionQueryChange(query);
  };

  const emitChange = () => {
    const editor = editorRef.current;
    if (!editor) return;
    onChange(serializeEditor(editor));
    updateMentionQuery();
  };

  const insertMention = (member: MentionComposerMember) => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.focus();
    const selection = window.getSelection();
    const range = activeMentionRangeRef.current || lastSelectionRangeRef.current || document.createRange();
    if (!range.commonAncestorContainer || !editor.contains(range.commonAncestorContainer)) {
      range.selectNodeContents(editor);
      range.collapse(false);
    }
    range.deleteContents();
    const chip = document.createElement("span");
    chip.className = "composer-mention-chip";
    chip.contentEditable = "false";
    chip.dataset.mentionUserId = String(member.userId);
    chip.textContent = `@${member.name}`;
    const caretAnchor = document.createTextNode(ZERO_WIDTH);
    range.insertNode(caretAnchor);
    range.insertNode(chip);
    placeCaretAfter(caretAnchor);
    debugMention("insert");
    activeMentionRangeRef.current = null;
    lastSelectionRangeRef.current = null;
    onMentionQueryChange(null);
    emitChange();
  };

  const insertTextAtSelection = (text: string, shouldFocus: boolean) => {
    const editor = editorRef.current;
    if (!editor) return;
    if (shouldFocus) editor.focus();
    const selection = window.getSelection();
    const range = shouldFocus && selection?.rangeCount && editor.contains(selection.getRangeAt(0).commonAncestorContainer)
      ? selection.getRangeAt(0)
      : lastSelectionRangeRef.current && editor.contains(lastSelectionRangeRef.current.commonAncestorContainer)
        ? lastSelectionRangeRef.current
        : null;
    const target = range?.cloneRange() || document.createRange();
    if (!range) {
      target.selectNodeContents(editor);
      target.collapse(false);
    }
    target.deleteContents();
    const node = document.createTextNode(text);
    target.insertNode(node);
    const nextRange = document.createRange();
    nextRange.setStartAfter(node);
    nextRange.collapse(true);
    lastSelectionRangeRef.current = nextRange.cloneRange();
    if (shouldFocus) placeCaretAfter(node);
    if (shouldFocus) emitChange();
    else {
      onChange(serializeEditor(editor));
      onMentionQueryChange(null);
    }
  };

  const insertText = (text: string) => insertTextAtSelection(text, true);

  const openMentionPicker = () => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.focus();
    const selection = window.getSelection();
    const currentRange = selection?.rangeCount && editor.contains(selection.getRangeAt(0).commonAncestorContainer)
      ? selection.getRangeAt(0)
      : lastSelectionRangeRef.current && editor.contains(lastSelectionRangeRef.current.commonAncestorContainer)
        ? lastSelectionRangeRef.current
        : null;
    const range = currentRange?.cloneRange() || document.createRange();
    if (!currentRange) {
      range.selectNodeContents(editor);
      range.collapse(false);
    }
    const beforeRange = document.createRange();
    beforeRange.selectNodeContents(editor);
    beforeRange.setEnd(range.startContainer, range.startOffset);
    const needsSpace = beforeRange.toString().length > 0 && !/[\s，。！？、,.!?]$/u.test(beforeRange.toString());
    range.deleteContents();
    const node = document.createTextNode(`${needsSpace ? " " : ""}@`);
    range.insertNode(node);
    const mentionRange = document.createRange();
    mentionRange.setStart(node, node.length - 1);
    mentionRange.setEnd(node, node.length);
    activeMentionRangeRef.current = mentionRange;
    placeCaretAfter(node);
    lastSelectionRangeRef.current = window.getSelection()?.getRangeAt(0).cloneRange() || null;
    onChange(serializeEditor(editor));
    onMentionQueryChange("");
  };

  useImperativeHandle(forwardedRef, () => ({
    getElement: () => editorRef.current,
    focus: () => editorRef.current?.focus(),
    blur: () => editorRef.current?.blur(),
    insertMention,
    insertText,
    openMentionPicker,
    insertTextWithoutFocus: (text: string) => insertTextAtSelection(text, false),
    moveCaretToEnd: () => {
      const editor = editorRef.current;
      if (!editor) return;
      const range = document.createRange();
      range.selectNodeContents(editor);
      range.collapse(false);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
    },
  }));

  useLayoutEffect(() => {
    const editor = editorRef.current;
    if (!editor || serializeEditor(editor) === value) return;
    appendValue(editor, value, memberNames);
  }, [value, members]);

  const handleMentionBackspace = (preventDefault: () => void) => {
    const selection = window.getSelection();
    if (!selection?.isCollapsed || !selection.rangeCount) return false;
    const range = selection.getRangeAt(0);
    const chip = mentionBeforeCaret(range);
    if (!chip || !editorRef.current?.contains(chip)) return false;
    preventDefault();
    if (armedChipRef.current === chip) {
      let next = chip.nextSibling;
      chip.remove();
      while (next?.nodeType === Node.TEXT_NODE && !/[^\u200B]/u.test(next.textContent || "")) {
        const following = next.nextSibling;
        next.remove();
        next = following;
      }
      armedChipRef.current = null;
      debugMention("remove");
      emitChange();
      return true;
    }
    armedChipRef.current?.classList.remove("is-delete-armed");
    armedChipRef.current = chip;
    chip.classList.add("is-delete-armed");
    debugMention("armed");
    return true;
  };

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Backspace") debugMention("keydown", { keyCode: event.nativeEvent.keyCode, composing: event.nativeEvent.isComposing });
    if (event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229) return;
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      if (!onSelectFirstMention()) onSubmit();
      return;
    }
    if (event.key !== "Backspace") {
      if (armedChipRef.current) armedChipRef.current.classList.remove("is-delete-armed");
      armedChipRef.current = null;
      return;
    }
    handleMentionBackspace(() => event.preventDefault());
  };

  return (
    <div
      aria-label={placeholder}
      className={className}
      contentEditable
      data-placeholder={placeholder}
      onBlur={() => { rememberSelection(); onMentionQueryChange(null); }}
      onFocus={onFocus}
      onBeforeInput={(event) => {
        const nativeEvent = event.nativeEvent as InputEvent;
        const inputType = nativeEvent.inputType;
        if (inputType?.startsWith("delete")) debugMention("beforeinput", { inputType });
        if (inputType === "deleteContentBackward" && !nativeEvent.isComposing) {
          handleMentionBackspace(() => event.preventDefault());
        }
      }}
      onInput={(event) => {
        const inputType = (event.nativeEvent as InputEvent).inputType;
        if (inputType?.startsWith("delete")) debugMention("input", { inputType });
        emitChange();
      }}
      onKeyDown={handleKeyDown}
      onKeyUp={updateMentionQuery}
      onPaste={(event) => {
        onPaste?.(event);
        if (event.defaultPrevented) return;
        event.preventDefault();
        insertText(event.clipboardData.getData("text/plain"));
      }}
      onPointerUp={rememberSelection}
      ref={editorRef}
      role="textbox"
      suppressContentEditableWarning
    />
  );
});
