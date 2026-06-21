export interface StockInRecord {
  date: string;
  amount: string;
  cost: string;
  refSellPrice: string;
}

export interface StockOutRecord {
  date: string;
  amount: string;
  price: string;
}

export interface StockRecords {
  in: StockInRecord[];
  out: StockOutRecord[];
}

export interface Category {
  key: string;
  label: string;
  sourceName?: string;
  sortOrder?: number;
}

export interface Item {
  id?: string;
  name: string;
  source: string;
  size: string;
  weight: string;
  material: string;
  remarks: string;
  img: string;
  stockRecords: StockRecords;
}

export type StockRecordKind = "in" | "out";

export interface StockRecordPreview {
  kind: StockRecordKind;
  date: string;
  amount: string;
  priceLabel: string;
  price: string;
}

export interface ItemMetrics {
  currentPrice: string;
  inStock: number;
  sold: number;
}

export interface RecordUpdate {
  ins?: StockInRecord;
  outs?: StockOutRecord;
}
