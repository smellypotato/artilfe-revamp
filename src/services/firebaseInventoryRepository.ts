import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  setDoc,
  type CollectionReference,
  type DocumentData,
} from "firebase/firestore";
import { deleteObject, getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { firestore, storage } from "./firebaseApp";
import type { InventoryRepository } from "./inventoryRepository";
import type { Item, RecordUpdate } from "../types/inventory";

const PLACEHOLDER_IMAGE = "https://via.placeholder.com/300x220?text=No+Image";

function stockCollection(type: string) {
  return collection(
    firestore,
    "Stock",
    "Stocks",
    type,
  ) as CollectionReference<DocumentData>;
}

function stockDocument(type: string, id: string) {
  return doc(firestore, "Stock", "Stocks", type, id);
}

function normalizeItem(id: string, data: DocumentData): Item {
  return {
    id,
    name: data.name ?? "",
    source: data.source ?? "",
    size: data.size ?? "",
    weight: data.weight ?? "",
    material: data.material ?? "",
    remarks: data.remarks ?? "",
    img: data.img ?? "",
    stockRecords: {
      in: Array.isArray(data.stockRecords?.in) ? data.stockRecords.in : [],
      out: Array.isArray(data.stockRecords?.out) ? data.stockRecords.out : [],
    },
  };
}

function toFirestoreItem(item: Item) {
  const { id: _id, ...payload } = item;
  return payload;
}

async function uploadImage(type: string, file: File, fileName: string) {
  const imageRef = ref(storage, `${type}/${fileName}`);
  await uploadBytes(imageRef, file);
  return getDownloadURL(imageRef);
}

export const firebaseInventoryRepository: InventoryRepository = {
  async getCategories() {
    const snapshot = await getDoc(doc(firestore, "Stock", "Stocks"));
    const data = snapshot.data();
    return Array.isArray(data?.type)
      ? data.type.map((label: string, index: number) => ({
          key: label,
          label,
          sourceName: label,
          sortOrder: index,
        }))
      : [];
  },

  subscribeItems(type, onChange) {
    return onSnapshot(stockCollection(type), (snapshot) => {
      const items = snapshot.docs.map((itemDoc) =>
        normalizeItem(itemDoc.id, itemDoc.data()),
      );
      onChange(items);
    });
  },

  async addItem(type, item, imageFile) {
    const id = item.id?.trim();

    if (!id) {
      throw new Error("未輸入編號。");
    }

    const itemRef = stockDocument(type, id);
    const existingItem = await getDoc(itemRef);

    if (existingItem.exists()) {
      return false;
    }

    const img = imageFile
      ? await uploadImage(type, imageFile, id)
      : item.img || PLACEHOLDER_IMAGE;

    await setDoc(itemRef, toFirestoreItem({ ...item, id, img }));
    return true;
  },

  async editItem(type, item, imageFile) {
    const id = item.id?.trim();

    if (!id) {
      throw new Error("未輸入編號。");
    }

    const img = imageFile
      ? await uploadImage(type, imageFile, id)
      : item.img || PLACEHOLDER_IMAGE;

    await setDoc(stockDocument(type, id), toFirestoreItem({ ...item, id, img }));
  },

  async deleteItem(type, item) {
    const id = item.id?.trim();

    if (!id) return;

    await deleteObject(ref(storage, `${type}/${id}`)).catch(() => undefined);
    await deleteDoc(stockDocument(type, id));
  },

  async updateRecord(type, item, update) {
    const id = item.id?.trim();

    if (!id) {
      throw new Error("未輸入編號。");
    }

    const updatedItem: Item = {
      ...item,
      stockRecords: {
        in: update.ins
          ? [...item.stockRecords.in, update.ins]
          : [...item.stockRecords.in],
        out: update.outs
          ? [...item.stockRecords.out, update.outs]
          : [...item.stockRecords.out],
      },
    };

    await setDoc(stockDocument(type, id), toFirestoreItem(updatedItem));
  },

  async removeRecord(type, item, stockType, key) {
    const id = item.id?.trim();

    if (!id) {
      throw new Error("未輸入編號。");
    }

    const records = {
      in: [...item.stockRecords.in],
      out: [...item.stockRecords.out],
    };
    records[stockType].splice(key, 1);

    await setDoc(
      stockDocument(type, id),
      toFirestoreItem({ ...item, stockRecords: records }),
    );
  },
};
