import fs from "node:fs";

function skipWhitespace(source, state) {
  while (/\s/.test(source[state.index] || "")) state.index += 1;
}

function readString(source, state) {
  const start = state.index;
  if (source[state.index] !== '"') throw new Error("JSON string expected.");
  state.index += 1;
  while (state.index < source.length) {
    const character = source[state.index++];
    if (character === "\\") {
      if (state.index >= source.length) throw new Error("JSON escape is incomplete.");
      if (source[state.index++] === "u") state.index += 4;
      continue;
    }
    if (character === '"') return JSON.parse(source.slice(start, state.index));
  }
  throw new Error("JSON string is unterminated.");
}

function readValue(source, state) {
  skipWhitespace(source, state);
  const character = source[state.index];
  if (character === "{") return readObject(source, state);
  if (character === "[") return readArray(source, state);
  if (character === '"') {
    readString(source, state);
    return;
  }
  while (state.index < source.length && !",]}".includes(source[state.index])) state.index += 1;
}

function readObject(source, state) {
  state.index += 1;
  const keys = new Set();
  skipWhitespace(source, state);
  if (source[state.index] === "}") {
    state.index += 1;
    return;
  }
  while (state.index < source.length) {
    skipWhitespace(source, state);
    const key = readString(source, state);
    if (keys.has(key)) throw new Error(`Duplicate JSON object key: ${key}`);
    keys.add(key);
    skipWhitespace(source, state);
    if (source[state.index++] !== ":") throw new Error("JSON object separator is missing.");
    readValue(source, state);
    skipWhitespace(source, state);
    if (source[state.index] === "}") {
      state.index += 1;
      return;
    }
    if (source[state.index++] !== ",") throw new Error("JSON object delimiter is missing.");
  }
  throw new Error("JSON object is unterminated.");
}

function readArray(source, state) {
  state.index += 1;
  skipWhitespace(source, state);
  if (source[state.index] === "]") {
    state.index += 1;
    return;
  }
  while (state.index < source.length) {
    readValue(source, state);
    skipWhitespace(source, state);
    if (source[state.index] === "]") {
      state.index += 1;
      return;
    }
    if (source[state.index++] !== ",") throw new Error("JSON array delimiter is missing.");
  }
  throw new Error("JSON array is unterminated.");
}

export function parseStrictJson(source) {
  if (typeof source !== "string") throw new Error("JSON source must be text.");
  const value = JSON.parse(source);
  const state = { index: 0 };
  readValue(source, state);
  skipWhitespace(source, state);
  if (state.index !== source.length) throw new Error("JSON has trailing content.");
  return value;
}

export function readStrictJsonFile(filePath) {
  return parseStrictJson(fs.readFileSync(filePath, "utf8"));
}
