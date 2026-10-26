// Data layer. Uses Firestore when src/firebaseConfig.js has a config,
// otherwise (or in the direct trial, see demo.js) the browser's localStorage.
import { useEffect, useState, useCallback } from "react";
import { firebaseConfig } from "../firebaseConfig.js";
import * as fb from "./firebase.js";
import { fail } from "./notify.js";
import { DEMO } from "./demo.js";

export const CLOUD = !!firebaseConfig && !DEMO;
export { DEMO };

const now = () => new Date().toISOString();
export const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

// ---------------------------------------------------------------- local
const key = (col) => `planc:${col}`;
const readCol = (col) => {
  try { return JSON.parse(localStorage.getItem(key(col)) || "{}"); } catch { return {}; }
};
const writeCol = (col, map) => {
  localStorage.setItem(key(col), JSON.stringify(map));
  window.dispatchEvent(new CustomEvent("planc-store", { detail: col }));
};

const local = {
  async list(col) { return Object.values(readCol(col)); },
  async get(col, id) { return readCol(col)[id] || null; },
  async put(col, obj) {
    const map = readCol(col);
    map[obj.id] = obj;
    writeCol(col, map);
    return obj;
  },
  async remove(col, id) {
    const map = readCol(col);
    delete map[id];
    writeCol(col, map);
  },
  subscribe(col, cb) {
    const h = (e) => { if (e.detail === col) cb(); };
    window.addEventListener("planc-store", h);
    return () => window.removeEventListener("planc-store", h);
  },
};

const backend = CLOUD ? fb.db : local;

export async function list(col) { return backend.list(col); }
export async function get(col, id) { return backend.get(col, id); }
export async function put(col, obj, user) {
  const o = { ...obj, id: obj.id || newId(), updatedAt: now() };
  if (!o.createdAt) { o.createdAt = o.updatedAt; o.createdBy = user?.name || o.createdBy || ""; }
  o.updatedBy = user?.name || "";
  return backend.put(col, o).catch(fail);
}
export async function remove(col, id) { return backend.remove(col, id).catch(fail); }

// settings live in one collection keyed by name
export async function getSetting(name, fallback) {
  const s = await backend.get("settings", name);
  return s ? s.value : fallback;
}
export async function setSetting(name, value) {
  return backend.put("settings", { id: name, value, updatedAt: now() }).catch(fail);
}

// live list for React
export function useCollection(col) {
  const [items, setItems] = useState(null);
  const load = useCallback(() => backend.list(col).then(setItems), [col]);
  useEffect(() => {
    load();
    return backend.subscribe(col, load);
  }, [col, load]);
  return [items, load];
}

export function useSetting(name, fallback) {
  const [v, setV] = useState(undefined);
  useEffect(() => {
    let on = true;
    const load = () => getSetting(name, fallback).then((x) => on && setV(x));
    load();
    const un = backend.subscribe("settings", load);
    return () => { on = false; un(); };
  }, [name]); // eslint-disable-line react-hooks/exhaustive-deps
  return v === undefined ? fallback : v;
}
