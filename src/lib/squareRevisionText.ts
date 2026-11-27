const segmenter = typeof Intl.Segmenter === "function" ? new Intl.Segmenter(undefined, { granularity: "grapheme" }) : null;

function textUnits(text: string) {
  return text.split(/(\[em\]e\d+\[\/em\])/gi).flatMap((piece, index) =>
    index % 2 ? [piece] : segmenter ? Array.from(segmenter.segment(piece), unit => unit.segment) : Array.from(piece),
  );
}

export function diffSquareRevisionText(previous: string, current: string) {
  const before = textUnits(previous);
  const after = textUnits(current);
  let start = 0;
  while (start < before.length && start < after.length && before[start] === after[start]) start++;
  let beforeEnd = before.length;
  let afterEnd = after.length;
  while (beforeEnd > start && afterEnd > start && before[beforeEnd - 1] === after[afterEnd - 1]) {
    beforeEnd--;
    afterEnd--;
  }

  const parts: { text: string; changed: boolean }[] = [];
  const removed: string[] = [];
  const append = (text: string, changed: boolean) => {
    if (!text) return;
    const last = parts[parts.length - 1];
    if (last?.changed === changed) last.text += text;
    else parts.push({ text, changed });
  };
  append(after.slice(0, start).join(""), false);

  const oldLength = beforeEnd - start;
  const newLength = afterEnd - start;
  if (!oldLength || !newLength || oldLength * newLength > 100_000) {
    if (oldLength) removed.push(before.slice(start, beforeEnd).join(""));
    append(after.slice(start, afterEnd).join(""), true);
  } else {
    const stride = newLength + 1;
    const lengths = new Uint16Array((oldLength + 1) * stride);
    for (let a = oldLength - 1; a >= 0; a--) {
      for (let b = newLength - 1; b >= 0; b--) {
        const offset = a * stride + b;
        lengths[offset] = before[start + a] === after[start + b]
          ? lengths[offset + stride + 1] + 1
          : Math.max(lengths[offset + stride], lengths[offset + 1]);
      }
    }
    let a = 0;
    let b = 0;
    let deletion = "";
    while (a < oldLength || b < newLength) {
      if (a < oldLength && b < newLength && before[start + a] === after[start + b]) {
        if (deletion) removed.push(deletion);
        deletion = "";
        append(after[start + b], false);
        a++;
        b++;
      } else if (a < oldLength && (b === newLength || lengths[(a + 1) * stride + b] >= lengths[a * stride + b + 1])) {
        deletion += before[start + a++];
      } else {
        append(after[start + b++], true);
      }
    }
    if (deletion) removed.push(deletion);
  }
  append(after.slice(afterEnd).join(""), false);
  return { parts, removed };
}
