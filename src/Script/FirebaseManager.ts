import { firebaseInventoryRepository } from "../services/firebaseInventoryRepository";
import type { RecordUpdate } from "../types/inventory";
import { Interface } from "../Interface/sharedInterface";

export default class FirebaseManager {
  private static _instance: FirebaseManager;
  private unsubscribe?: () => void;

  static get instance() {
    if (!this._instance) {
      this._instance = new FirebaseManager();
    }
    return this._instance;
  }

  static initFirebase() {
    void FirebaseManager.instance;
  }

  async signIn() {
    return Promise.resolve();
  }

  async getTypes() {
    return firebaseInventoryRepository.getCategories();
  }

  toggleItemListener(type: string, toggle: boolean, cb?: () => void) {
    if (toggle && cb) {
      this.unsubscribe = firebaseInventoryRepository.subscribeItems(type, cb);
    } else {
      this.unsubscribe?.();
    }
  }

  async getItems(type: string) {
    return new Promise<Interface.Item[]>((resolve) => {
      const unsubscribe = firebaseInventoryRepository.subscribeItems(type, (items) => {
        unsubscribe();
        resolve(items);
      });
    });
  }

  async addItem(type: string, item: Interface.Item, imageFile?: File | null) {
    return firebaseInventoryRepository.addItem(type, item, imageFile);
  }

  async editItem(type: string, item: Interface.Item, imageFile?: File | null) {
    return firebaseInventoryRepository.editItem(type, item, imageFile);
  }

  async deleteItem(type: string, id: string) {
    return firebaseInventoryRepository.deleteItem(type, { id } as Interface.Item);
  }

  async updateRecord(type: string, item: Interface.Item, updateRecord: RecordUpdate) {
    return firebaseInventoryRepository.updateRecord(type, item, updateRecord);
  }

  async removeRecord(
    type: string,
    item: Interface.Item,
    stockType: "in" | "out",
    key: number,
  ) {
    return firebaseInventoryRepository.removeRecord(type, item, stockType, key);
  }
}
