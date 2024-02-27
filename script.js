const TAB_SIZE = 2;
const SECTION_PREFIX = ":";
const LABEL_PREFIX = "@";
const COMMENT_PREFIX = ";";

const DATATYPES = [
  "I8",
  "U8",
  "I16",
  "U16",
  "I32",
  "U32",
  "I64",
  "U64",
  "F32",
  "F64",
];

const INSTRUCTIONS = [
  "NOP",
  "SPTR",
  "IPTR",
  "SYS",
  "PUSH8",
  "PUSH16",
  "PUSH32",
  "PUSH64",
  "POP8",
  "POP16",
  "POP32",
  "POP64",
  "LDR8",
  "LDR16",
  "LDR32",
  "LDR64",
  "STR8",
  "STR16",
  "STR32",
  "STR64",
  "ADD8",
  "ADD16",
  "ADD32",
  "ADD64",
  "SUB8",
  "SUB16",
  "SUB32",
  "SUB64",
  "MUL8",
  "MUL16",
  "MUL32",
  "MUL64",
  "POW8",
  "POW16",
  "POW32",
  "POW64",
  "JMP",
  "JEQ",
  "JNE",
  "JGT",
  "JLT",
  "JGE",
  "JLE",
  "UCMP8",
  "UCMP16",
  "UCMP32",
  "UCMP64",
  "SCMP8",
  "SCMP16",
  "SCMP32",
  "SCMP64",
];

///////////////////////////////////////////////////////////////////////////////////////////

const editor_view = document.getElementById("editor-view");
const editor_pre = document.getElementById("editor-pre");
const editor_textarea = document.getElementById("editor-textarea");
const main_window = document.getElementById("main-window");
const sidebar = document.getElementById("sidebar");
const terminal_view = document.getElementById("terminal-view");
const terminal_pre = document.getElementById("terminal-pre");

const wasm_container = {};

async function main() {
  updateView(editor_textarea.value);
  const buf = await (await fetch("wasm-compiler.wasm")).arrayBuffer();
  const wasm = new WASM(buf, stdout_write);
  await wasm.init();
  wasm_container.wasm = wasm;
}

function updateView(value = " ") {
  let text = value
    .replaceAll(/&/g, "&amp")
    .replaceAll(/</g, "&lt;")
    .replaceAll(/>/g, "&gt;");
  if (text[text.length - 1] === "\n") text += " ";
  editor_view.innerHTML = highlight(text);
}

function highlight(text) {
  const tokens = tokenize(text);
  return tokens
    .map((t) => `<span class="${t.type}">${t.buffer}</span>`)
    .join("");
}

function stdout_write(value = " ") {
  const text = value
    .replaceAll(/&/g, "&amp")
    .replaceAll(/</g, "&lt;")
    .replaceAll(/>/g, "&gt;");
  terminal_view.innerHTML += text;
  terminal_pre.scrollTop = Number.POSITIVE_INFINITY;
}

function stdout_clear() {
  terminal_view.innerHTML = "";
}

function run() {
  if (!wasm_container.wasm) return;
  const wasm = wasm_container.wasm;
  const ptr = wasm.allocString(editor_textarea.value);
  stdout_clear();
  wasm.run_source(ptr);
}

function tokenize(text = "") {
  const res = [];
  let buffer = "";
  let type = "spaces";

  function clearBuffer(last = false) {
    if (isInstruction(buffer)) type = "instruction";
    else if (isDatatype(buffer)) type = "datatype";
    else if (isSection(buffer)) type = "section";
    else if (isLabel(buffer)) type = "label";
    else if (last && type === "identifier") type = "none";
    res.push({ buffer, type });
    buffer = "";
  }

  for (let i = 0; i < text.length; i++) {
    if (text[i] === "'" || text[i] === '"') {
      clearBuffer();
      type = "string";
      const symbol = text[i];
      buffer += text[i++];
      while (i < text.length && text[i] !== symbol) {
        if (text[i] !== "\\") buffer += text[i++];
        else {
          clearBuffer();
          type = "escaped";
          buffer += text[i++] + (text[i++] || "");
          if (buffer[1] === "x")
            buffer += (text[i++] || "") + (text[i++] || "");
          clearBuffer();
          type = "string";
        }
      }
      buffer += i < text.length ? text[i] : "";
      continue;
    }

    if (text[i] === COMMENT_PREFIX) {
      clearBuffer();
      while (i < text.length && text[i] !== "\n") buffer += text[i++];
      type = "comment";
    }

    if (/\s/.test(text[i])) {
      if (type !== "spaces") {
        clearBuffer();
        type = "spaces";
      }
      buffer += text[i];
      continue;
    }

    if (type === "spaces") {
      clearBuffer();
      if (Number.isNaN(+text[i])) type = "identifier";
      else type = "number";
    }

    if (type === "number") buffer += text[i];
    else if (type === "identifier") buffer += text[i];
  }
  clearBuffer(true);
  return res.filter(({ buffer }) => buffer.length > 0);
}

function isInstruction(word = "") {
  return INSTRUCTIONS.includes(word.toUpperCase());
}

function isDatatype(word = "") {
  return DATATYPES.includes(word.toUpperCase());
}

function isSection(word = "") {
  return word.startsWith(SECTION_PREFIX);
}

function isLabel(word = "") {
  return word.startsWith(LABEL_PREFIX);
}

function syncScroll(e) {
  editor_view.scrollTop = e.scrollTop;
  editor_view.scrollLeft = e.scrollLeft;
}

function updateMainWindow(btn) {
  for (const child of main_window.children)
    child.setAttribute(
      "style",
      child.id !== btn.id.split("-")[2] ? "display: none;" : "",
    );
  for (const button of sidebar.children)
    button.className =
      button.id === btn.id ? "sidebar-button-selected" : "sidebar-button";
  if (btn.id === "sidebar-button-terminal") run();
}

function checkSpecialKey(e, ev) {
  if (ev.key === "Tab") {
    if (e.selectionStart === e.selectionEnd) {
      if (ev.shiftKey) deindentCurrentPos(e, ev);
      else indentCurrentPos(e, ev);
    } else multiLineIndent(e, ev);
  } else if (ev.key === "Enter") {
    newLineWithIndent(e, ev);
  } else if ((ev.key === "Delete" || ev.key === "Backspace") && ev.shiftKey)
    deleteLines(e, ev);
}

function deleteLines(e, ev) {
  ev.preventDefault();

  const pos1 = e.value.substring(0, e.selectionStart).split("\n").length - 1;
  const pos2 = e.value.substring(0, e.selectionEnd).split("\n").length - 1;

  const lines = e.value.split("\n");
  lines.splice(pos1, pos2 - pos1 + 1);

  e.value = lines.join("\n");

  e.selectionStart = e.selectionEnd =
    lines.slice(0, pos1).join("\n").length +
    (pos1 > 0 ? 1 : 0) +
    Math.min(
      e.value.substring(0, e.selectionStart).split("\n").pop().length,
      lines[pos1]?.length || 0,
    );

  updateView(e.value);
}

function multiLineIndent(e, ev) {
  ev.preventDefault();
  const lines = e.value.split("\n");
  const pos1 = e.value.substring(0, e.selectionStart).split("\n").length - 1;
  const pos2 = e.value.substring(0, e.selectionEnd).split("\n").length - 1;

  let removedFirstLine = 0;
  let removedTotal = 0;

  if (ev.shiftKey) {
    const rx = new RegExp(`^ {1,${TAB_SIZE}}`);
    for (let i = pos1; i <= pos2; i++)
      lines[i] = lines[i].replace(rx, (m) => {
        if (i === pos1) removedFirstLine = m.length;
        removedTotal += m.length;
        return "";
      });
  } else
    for (let i = pos1; i <= pos2; i++)
      lines[i] = `${" ".repeat(TAB_SIZE)}${lines[i]}`;

  const start = e.selectionStart;
  const end = e.selectionEnd;

  e.value = lines.join("\n");

  e.selectionStart = ev.shiftKey ? start - removedFirstLine : start + TAB_SIZE;

  e.selectionEnd = ev.shiftKey
    ? end - removedTotal
    : end + TAB_SIZE * (pos2 - pos1 + 1);

  updateView(e.value);
}

function indentCurrentPos(e, ev) {
  event.preventDefault();
  const pos = e.selectionStart;
  e.setRangeText(`${" ".repeat(TAB_SIZE)}`, pos, pos, "end");
  updateView(e.value);
}

function deindentCurrentPos(e, ev) {
  event.preventDefault();
  const pos = e.selectionStart;
  const c = e.value
    .substring(e.selectionStart - TAB_SIZE, e.selectionStart)
    .split("")
    .map((c) => (c === " " ? 1 : 0))
    .reduce((a, c) => (c > 0 ? a + c : 0), 0);
  e.setRangeText("", pos - c, pos, "end");
  updateView(e.value);
}

function newLineWithIndent(e, ev) {
  ev.preventDefault();
  const indent = e.value
    .substring(0, e.selectionStart)
    .split("\n")
    .slice(-1)[0]
    .match(/^\s*/)[0];
  e.setRangeText(`\n${indent}`, e.selectionStart, e.selectionEnd, "end");
  updateView(e.value);
}
