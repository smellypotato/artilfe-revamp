import { supabaseEdgeConfig } from "./supabaseEdgeConfig";
import { getAuthHeaders, handleUnauthorizedResponse } from "./authService";
import { checkStorageAfterDataFetch } from "./storageStatusService";
import type { InventoryRepository } from "./inventoryRepository";
import type { Category, Item, RecordUpdate } from "../types/inventory";

const inventoryApiBase = `${supabaseEdgeConfig.url}/functions/v1/inventory-api`;
const imageUploadUrl = `${supabaseEdgeConfig.url}/functions/v1/image-upload`;

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const authHeaders = await getAuthHeaders(!(init.body instanceof FormData));
  const response = await fetch(`${inventoryApiBase}${path}`, {
    ...init,
    headers: {
      ...authHeaders,
      ...init.headers,
    },
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    if (await handleUnauthorizedResponse(response)) {
      throw new Error("登入已過期，請重新登入。");
    }
    throw new Error(payload.error ?? "Supabase API request failed.");
  }

  return payload as T;
}

async function uploadImage(categoryKey: string, itemId: string, file: File) {
  const formData = new FormData();
  formData.set("categoryKey", categoryKey);
  formData.set("itemId", itemId);
  formData.set("file", file);

  const authHeaders = await getAuthHeaders(false);
  const response = await fetch(imageUploadUrl, {
    method: "POST",
    headers: authHeaders,
    body: formData,
  });
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    if (await handleUnauthorizedResponse(response)) {
      throw new Error("登入已過期，請重新登入。");
    }
    throw new Error(payload.error ?? "Image upload failed.");
  }

  return payload as { path: string; publicUrl: string };
}

export const supabaseEdgeInventoryRepository: InventoryRepository = {
  async getCategories() {
    const payload = await request<{ categories: Category[] }>("/categories");
    checkStorageAfterDataFetch();
    return payload.categories;
  },

  subscribeItems(type, onChange) {
    request<{ items: Item[] }>(`/items/${encodeURIComponent(type)}`)
      .then((payload) => {
        checkStorageAfterDataFetch();
        onChange(payload.items);
      })
      .catch((error) => {
        console.error("Unable to load Supabase items", error);
        onChange([]);
      });

    return () => undefined;
  },

  async addItem(type, item, imageFile) {
    let imagePath: string | undefined;

    if (imageFile && item.id) {
      const uploaded = await uploadImage(type, item.id, imageFile);
      imagePath = uploaded.path;
    }

    const payload = await request<{ item: Item }>(`/items/${encodeURIComponent(type)}`, {
      method: "POST",
      body: JSON.stringify({ item, imagePath }),
    });
    item.img = payload.item.img;
    checkStorageAfterDataFetch();
    return true;
  },

  async editItem(type, item, imageFile) {
    let imagePath: string | undefined;

    if (imageFile && item.id) {
      const uploaded = await uploadImage(type, item.id, imageFile);
      imagePath = uploaded.path;
    }

    await request(`/items/${encodeURIComponent(type)}/${encodeURIComponent(item.id ?? "")}`, {
      method: "PATCH",
      body: JSON.stringify({ item, imagePath }),
    });
    checkStorageAfterDataFetch();
  },

  async deleteItem(type, item) {
    if (!item.id) return;

    await request(`/items/${encodeURIComponent(type)}/${encodeURIComponent(item.id)}`, {
      method: "DELETE",
    });
    checkStorageAfterDataFetch();
  },

  async updateRecord(type, item, update: RecordUpdate) {
    if (!item.id) return;

    const recordType = update.outs ? "out" : "in";
    const record = update.outs ?? update.ins;

    await request(
      `/items/${encodeURIComponent(type)}/${encodeURIComponent(item.id)}/records`,
      {
        method: "POST",
        body: JSON.stringify({ recordType, record }),
      },
    );
  },

  async removeRecord(type, item, stockType, key) {
    if (!item.id) return;

    await request(
      `/items/${encodeURIComponent(type)}/${encodeURIComponent(item.id)}/records`,
      {
        method: "DELETE",
        body: JSON.stringify({ recordType: stockType, recordIndex: key }),
      },
    );
  },
};
