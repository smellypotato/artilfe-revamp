import type {
  Item as InventoryItem,
  StockInRecord,
  StockOutRecord,
} from "../types/inventory";

export namespace Interface {
  export interface LoginPanel {
    account: string;
    password: string;
    message: string;
    isLoggedIn: boolean;
  }

  export interface User {
    isAuthencated: boolean;
  }

  export type Item = InventoryItem;
  export type In = StockInRecord;
  export type Out = StockOutRecord;
}
