import type { Category, Item, RecordUpdate } from "../types/inventory";

export type Unsubscribe = () => void;

export interface InventoryRepository {
  getCategories(): Promise<Category[]>;
  subscribeItems(type: string, onChange: (items: Item[]) => void): Unsubscribe;
  addItem(type: string, item: Item, imageFile?: File | null): Promise<boolean>;
  editItem(type: string, item: Item, imageFile?: File | null): Promise<void>;
  deleteItem(type: string, item: Item): Promise<void>;
  updateRecord(type: string, item: Item, update: RecordUpdate): Promise<void>;
  removeRecord(
    type: string,
    item: Item,
    stockType: "in" | "out",
    key: number,
  ): Promise<void>;
}
