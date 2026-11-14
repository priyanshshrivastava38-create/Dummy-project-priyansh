import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

function storageRoot() {
  return path.resolve(process.cwd(), process.env.STORAGE_LOCAL_DIR || "storage");
}

function assertSupportedDriver() {
  const driver = process.env.STORAGE_DRIVER || "local";
  if (driver !== "local") {
    throw new Error(
      `STORAGE_DRIVER="${driver}" is not implemented. This build uses local disk storage; see README → "Document storage" for the adapter contract.`,
    );
  }
}

function safePath(key: string) {
  const root = storageRoot();
  const target = path.resolve(root, key);
  if (target !== root && !target.startsWith(root + path.sep)) {
    throw new Error("Invalid storage key");
  }
  return target;
}

export async function putObject(key: string, data: Buffer) {
  assertSupportedDriver();
  const target = safePath(key);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, data);
  return key;
}

export async function getObject(key: string) {
  assertSupportedDriver();
  return readFile(safePath(key));
}

export async function removeObject(key: string) {
  assertSupportedDriver();
  await unlink(safePath(key)).catch(() => undefined);
}

export function makeStorageKey(parts: { orgId: string; kind: "quotations" | "requests" | "contracts"; id: string; fileName: string }) {
  const base = path.basename(parts.fileName).replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);
  return `${parts.orgId}/${parts.kind}/${parts.id}/${randomUUID()}-${base}`;
}

export function isPdf(file: { name: string; type: string; buffer: Buffer }) {
  if (file.type && file.type !== "application/pdf") return false;
  if (!/\.pdf$/i.test(file.name)) return false;
  return file.buffer.subarray(0, 5).toString("latin1") === "%PDF-";
}
