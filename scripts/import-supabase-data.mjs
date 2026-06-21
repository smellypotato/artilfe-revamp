import { readdir, readFile } from "node:fs/promises";
import { createReadStream, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY;
const BUCKET = process.env.SUPABASE_IMAGE_BUCKET ?? "images";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const exportRoot =
  process.env.FIREBASE_EXPORT_DIR ??
  path.join(repoRoot, "exports", "firebase-2026-06-21T13-09-48-282Z");

if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SECRET_KEY. See .env.example.");
  process.exit(1);
}

function encodeStoragePath(storagePath) {
  return storagePath.split("/").map(encodeURIComponent).join("/");
}

function sanitizePathSegment(value) {
  return String(value || "unknown")
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_")
    .trim();
}

function numberOrNull(value) {
  if (value === undefined || value === null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function amountOrZero(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.trunc(parsed)) : 0;
}

function contentTypeFor(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  if (extension === ".jpg" || extension === ".jpeg") return "image/jpeg";
  if (extension === ".png") return "image/png";
  if (extension === ".webp") return "image/webp";
  if (extension === ".gif") return "image/gif";
  if (extension === ".svg") return "image/svg+xml";
  return "application/octet-stream";
}

async function jsonFile(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function supabaseFetch(pathname, options = {}) {
  const response = await fetch(`${SUPABASE_URL}${pathname}`, {
    ...options,
    headers: {
      apikey: SUPABASE_SECRET_KEY,
      Authorization: `Bearer ${SUPABASE_SECRET_KEY}`,
      ...options.headers,
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`${options.method ?? "GET"} ${pathname} failed: ${text}`);
  }

  const contentType = response.headers.get("content-type") ?? "";
  return contentType.includes("application/json") ? response.json() : response.text();
}

async function deleteExistingData() {
  await supabaseFetch("/rest/v1/categories?key=not.is.null", {
    method: "DELETE",
    headers: {
      Prefer: "return=minimal",
    },
  });
}

async function insertRows(table, rows, chunkSize = 500) {
  for (let index = 0; index < rows.length; index += chunkSize) {
    const chunk = rows.slice(index, index + chunkSize);
    if (!chunk.length) continue;

    await supabaseFetch(`/rest/v1/${table}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify(chunk),
    });
  }
}

async function uploadFile(localPath, storagePath) {
  const response = await fetch(
    `${SUPABASE_URL}/storage/v1/object/${BUCKET}/${encodeStoragePath(storagePath)}`,
    {
      method: "POST",
      headers: {
        apikey: SUPABASE_SECRET_KEY,
        Authorization: `Bearer ${SUPABASE_SECRET_KEY}`,
        "Content-Type": contentTypeFor(localPath),
        "x-upsert": "true",
      },
      body: createReadStream(localPath),
      duplex: "half",
    },
  );

  if (!response.ok) {
    throw new Error(`Upload failed for ${storagePath}: ${await response.text()}`);
  }
}

async function listFilesRecursive(directory) {
  if (!existsSync(directory)) return [];

  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listFilesRecursive(fullPath)));
    } else {
      files.push(fullPath);
    }
  }

  return files;
}

function buildLocalImageMap(manifest) {
  const map = new Map();

  for (const file of manifest.storageFiles ?? []) {
    if (!file.categoryKey || !file.savedPath) continue;
    const localPath = path.join(exportRoot, file.savedPath);
    const itemCode = path.basename(file.savedPath, path.extname(file.savedPath));
    map.set(`${file.categoryKey}/${itemCode}`, localPath);
  }

  for (const image of manifest.referencedImages ?? []) {
    if (!image.categoryKey || !image.itemId || !image.savedPath) continue;
    const key = `${image.categoryKey}/${sanitizePathSegment(image.itemId)}`;
    if (!map.has(key)) {
      map.set(key, path.join(exportRoot, image.savedPath));
    }
  }

  return map;
}

async function uploadAllStorageFiles(uploadedPaths) {
  const storageRoot = path.join(exportRoot, "storage");
  const files = await listFilesRecursive(storageRoot);

  for (const localPath of files) {
    const relativePath = path.relative(storageRoot, localPath).replaceAll("\\", "/");
    await uploadFile(localPath, relativePath);
    uploadedPaths.add(relativePath);
  }
}

async function main() {
  const manifest = await jsonFile(path.join(exportRoot, "manifest.json"));
  const localImageMap = buildLocalImageMap(manifest);
  const uploadedPaths = new Set();

  console.log(`Importing export: ${exportRoot}`);
  console.log("Clearing existing inventory rows...");
  await deleteExistingData();

  console.log("Uploading storage images...");
  await uploadAllStorageFiles(uploadedPaths);

  const categories = manifest.categories.map((category, index) => ({
    key: category.key,
    label: category.label,
    source_name: category.sourceName,
    sort_order: index,
  }));
  const items = [];
  const stockRecords = [];

  for (const category of manifest.categories) {
    const documents = await jsonFile(path.join(exportRoot, category.savedPath));

    for (const document of documents) {
      const data = document.data ?? {};
      const itemCode = document.id;
      const imageKey = `${category.key}/${sanitizePathSegment(itemCode)}`;
      const imageFile = localImageMap.get(imageKey);
      let imagePath = null;

      if (imageFile && existsSync(imageFile)) {
        const extension = path.extname(imageFile) || ".jpg";
        imagePath = `${category.key}/${sanitizePathSegment(itemCode)}${extension}`;
        if (!uploadedPaths.has(imagePath)) {
          await uploadFile(imageFile, imagePath);
          uploadedPaths.add(imagePath);
        }
      }

      items.push({
        category_key: category.key,
        item_code: itemCode,
        name: data.name ?? "",
        source: data.source ?? "",
        size: data.size ?? "",
        weight: data.weight ?? "",
        material: data.material ?? "",
        remarks: data.remarks ?? "",
        image_path: imagePath,
        legacy_image_url: data.img ?? "",
        raw_data: data,
      });

      for (const [recordIndex, record] of (data.stockRecords?.in ?? []).entries()) {
        stockRecords.push({
          category_key: category.key,
          item_code: itemCode,
          record_type: "in",
          record_index: recordIndex,
          date_label: record.date ?? "",
          amount: amountOrZero(record.amount),
          cost: numberOrNull(record.cost),
          ref_sell_price: numberOrNull(record.refSellPrice),
          price: null,
          raw_data: record,
        });
      }

      for (const [recordIndex, record] of (data.stockRecords?.out ?? []).entries()) {
        stockRecords.push({
          category_key: category.key,
          item_code: itemCode,
          record_type: "out",
          record_index: recordIndex,
          date_label: record.date ?? "",
          amount: amountOrZero(record.amount),
          cost: null,
          ref_sell_price: null,
          price: numberOrNull(record.price),
          raw_data: record,
        });
      }
    }
  }

  console.log("Inserting categories...");
  await insertRows("categories", categories);

  console.log(`Inserting ${items.length} items...`);
  await insertRows("items", items);

  console.log(`Inserting ${stockRecords.length} stock records...`);
  await insertRows("stock_records", stockRecords);

  console.log("Supabase import complete.");
  console.log(`Categories: ${categories.length}`);
  console.log(`Items: ${items.length}`);
  console.log(`Stock records: ${stockRecords.length}`);
  console.log(`Uploaded image paths: ${uploadedPaths.size}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
