import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireAuth } from "../_shared/auth.ts";
import { handleOptions, jsonResponse } from "../_shared/cors.ts";

type StockInRecord = {
  date: string;
  amount: string;
  cost: string;
  refSellPrice: string;
};

type StockOutRecord = {
  date: string;
  amount: string;
  price: string;
};

type ItemRow = {
  category_key: string;
  item_code: string;
  name: string;
  source: string;
  size: string;
  weight: string;
  material: string;
  remarks: string;
  image_path: string | null;
  legacy_image_url: string | null;
};

type StockRecordRow = {
  id: number;
  category_key: string;
  item_code: string;
  record_type: "in" | "out";
  record_index: number;
  date_label: string;
  amount: number;
  cost: string | null;
  ref_sell_price: string | null;
  price: string | null;
};

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const serviceKey =
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ??
  Deno.env.get("SUPABASE_SECRET_KEY") ??
  "";
const supabase = createClient(supabaseUrl, serviceKey);

function publicImageUrl(path: string | null) {
  if (!path) return "";
  const { data } = supabase.storage.from("images").getPublicUrl(path);
  return data.publicUrl;
}

function toRecordPayload(record: StockRecordRow) {
  if (record.record_type === "in") {
    return {
      date: record.date_label,
      amount: String(record.amount),
      cost: record.cost ?? "0",
      refSellPrice: record.ref_sell_price ?? "0",
    } satisfies StockInRecord;
  }

  return {
    date: record.date_label,
    amount: String(record.amount),
    price: record.price ?? "0",
  } satisfies StockOutRecord;
}

function toItemPayload(item: ItemRow, records: StockRecordRow[] = []) {
  return {
    id: item.item_code,
    name: item.name,
    source: item.source,
    size: item.size,
    weight: item.weight,
    material: item.material,
    remarks: item.remarks,
    img: publicImageUrl(item.image_path) || item.legacy_image_url || "",
    imagePath: item.image_path,
    categoryKey: item.category_key,
    stockRecords: {
      in: records
        .filter((record) => record.record_type === "in")
        .sort((a, b) => a.record_index - b.record_index)
        .map(toRecordPayload),
      out: records
        .filter((record) => record.record_type === "out")
        .sort((a, b) => a.record_index - b.record_index)
        .map(toRecordPayload),
    },
  };
}

function parseNumber(value: unknown) {
  if (value === "" || value === undefined || value === null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseAmount(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.trunc(parsed)) : 0;
}

async function readBody(request: Request) {
  if (request.headers.get("content-length") === "0") return {};
  return request.json().catch(() => ({}));
}

async function listCategories() {
  const { data, error } = await supabase
    .from("categories")
    .select("key,label,source_name,sort_order")
    .order("sort_order", { ascending: true });

  if (error) throw error;
  return data;
}

async function listItems(categoryKey: string) {
  const { data: items, error: itemError } = await supabase
    .from("items")
    .select("*")
    .eq("category_key", categoryKey)
    .order("item_code", { ascending: true });

  if (itemError) throw itemError;

  const { data: records, error: recordError } = await supabase
    .from("stock_records")
    .select("*")
    .eq("category_key", categoryKey)
    .order("record_index", { ascending: true });

  if (recordError) throw recordError;

  const recordsByItem = new Map<string, StockRecordRow[]>();
  for (const record of (records ?? []) as StockRecordRow[]) {
    recordsByItem.set(record.item_code, [
      ...(recordsByItem.get(record.item_code) ?? []),
      record,
    ]);
  }

  return ((items ?? []) as ItemRow[]).map((item) =>
    toItemPayload(item, recordsByItem.get(item.item_code) ?? []),
  );
}

async function getItem(categoryKey: string, itemCode: string) {
  const { data: item, error: itemError } = await supabase
    .from("items")
    .select("*")
    .eq("category_key", categoryKey)
    .eq("item_code", itemCode)
    .single();

  if (itemError) throw itemError;

  const { data: records, error: recordError } = await supabase
    .from("stock_records")
    .select("*")
    .eq("category_key", categoryKey)
    .eq("item_code", itemCode)
    .order("record_index", { ascending: true });

  if (recordError) throw recordError;

  return toItemPayload(item as ItemRow, (records ?? []) as StockRecordRow[]);
}

async function upsertItem(categoryKey: string, body: Record<string, unknown>) {
  const item = body.item as Record<string, unknown> | undefined;
  if (!item?.id) throw new Error("Missing item id.");

  const payload = {
    category_key: categoryKey,
    item_code: String(item.id),
    name: String(item.name ?? ""),
    source: String(item.source ?? ""),
    size: String(item.size ?? ""),
    weight: String(item.weight ?? ""),
    material: String(item.material ?? ""),
    remarks: String(item.remarks ?? ""),
    image_path: String(body.imagePath ?? item.imagePath ?? "") || null,
    legacy_image_url: String(item.img ?? "") || null,
    raw_data: item,
  };

  const { error } = await supabase.from("items").upsert(payload, {
    onConflict: "category_key,item_code",
  });
  if (error) throw error;
  return getItem(categoryKey, payload.item_code);
}

async function deleteItem(categoryKey: string, itemCode: string) {
  const { data: item } = await supabase
    .from("items")
    .select("image_path")
    .eq("category_key", categoryKey)
    .eq("item_code", itemCode)
    .maybeSingle();

  const { error } = await supabase
    .from("items")
    .delete()
    .eq("category_key", categoryKey)
    .eq("item_code", itemCode);
  if (error) throw error;

  if (item?.image_path) {
    await supabase.storage.from("images").remove([item.image_path]);
  }

  return { ok: true };
}

async function addStockRecord(
  categoryKey: string,
  itemCode: string,
  body: Record<string, unknown>,
) {
  const recordType = body.recordType === "out" ? "out" : "in";
  const record = body.record as Record<string, unknown> | undefined;
  if (!record) throw new Error("Missing stock record.");

  const { count, error: countError } = await supabase
    .from("stock_records")
    .select("id", { count: "exact", head: true })
    .eq("category_key", categoryKey)
    .eq("item_code", itemCode)
    .eq("record_type", recordType);

  if (countError) throw countError;

  const payload = {
    category_key: categoryKey,
    item_code: itemCode,
    record_type: recordType,
    record_index: count ?? 0,
    date_label: String(record.date ?? ""),
    amount: parseAmount(record.amount),
    cost: recordType === "in" ? parseNumber(record.cost) : null,
    ref_sell_price:
      recordType === "in" ? parseNumber(record.refSellPrice) : null,
    price: recordType === "out" ? parseNumber(record.price) : null,
    raw_data: record,
  };

  const { error } = await supabase.from("stock_records").insert(payload);
  if (error) throw error;
  return getItem(categoryKey, itemCode);
}

async function deleteStockRecord(
  categoryKey: string,
  itemCode: string,
  body: Record<string, unknown>,
) {
  const recordType = body.recordType === "out" ? "out" : "in";
  const recordIndex = Number(body.recordIndex);
  if (!Number.isInteger(recordIndex)) throw new Error("Missing record index.");

  const { error } = await supabase
    .from("stock_records")
    .delete()
    .eq("category_key", categoryKey)
    .eq("item_code", itemCode)
    .eq("record_type", recordType)
    .eq("record_index", recordIndex);

  if (error) throw error;
  return getItem(categoryKey, itemCode);
}

Deno.serve(async (request) => {
  const optionsResponse = handleOptions(request);
  if (optionsResponse) return optionsResponse;

  const authResult = await requireAuth(request);
  if ("response" in authResult) return authResult.response;

  try {
    const url = new URL(request.url);
    const pathParts = url.pathname
      .replace(/^\/inventory-api\/?/, "")
      .split("/")
      .filter(Boolean);
    const [resource, categoryKey, itemCode, child] = pathParts;

    if (request.method === "GET" && resource === "categories") {
      return jsonResponse({ categories: await listCategories() });
    }

    if (resource === "items" && request.method === "GET" && categoryKey && !itemCode) {
      return jsonResponse({ items: await listItems(categoryKey) });
    }

    if (resource === "items" && request.method === "GET" && categoryKey && itemCode) {
      return jsonResponse({ item: await getItem(categoryKey, itemCode) });
    }

    if (resource === "items" && request.method === "POST" && categoryKey) {
      return jsonResponse({ item: await upsertItem(categoryKey, await readBody(request)) });
    }

    if (resource === "items" && request.method === "PATCH" && categoryKey && itemCode) {
      const body = await readBody(request);
      return jsonResponse({
        item: await upsertItem(categoryKey, {
          ...body,
          item: { ...(body.item ?? {}), id: itemCode },
        }),
      });
    }

    if (resource === "items" && request.method === "DELETE" && categoryKey && itemCode) {
      return jsonResponse(await deleteItem(categoryKey, itemCode));
    }

    if (
      resource === "items" &&
      child === "records" &&
      request.method === "POST" &&
      categoryKey &&
      itemCode
    ) {
      return jsonResponse({
        item: await addStockRecord(categoryKey, itemCode, await readBody(request)),
      });
    }

    if (
      resource === "items" &&
      child === "records" &&
      request.method === "DELETE" &&
      categoryKey &&
      itemCode
    ) {
      return jsonResponse({
        item: await deleteStockRecord(categoryKey, itemCode, await readBody(request)),
      });
    }

    return jsonResponse({ error: "Not found." }, { status: 404 });
  } catch (error) {
    console.error(error);
    return jsonResponse(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
});
