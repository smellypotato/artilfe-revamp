import type {
  Item,
  ItemMetrics,
  RecordUpdate,
  StockInRecord,
  StockOutRecord,
  StockRecordPreview,
} from "../types/inventory";

export const emptyItem = (): Item => ({
  id: "",
  name: "",
  source: "",
  size: "",
  weight: "",
  material: "",
  remarks: "",
  img: "",
  stockRecords: {
    in: [],
    out: [],
  },
});

const toNumber = (value: string | number | undefined) => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

export function getItemMetrics(item: Item): ItemMetrics {
  const incoming = item.stockRecords.in.reduce(
    (total, record) => total + toNumber(record.amount),
    0,
  );
  const outgoing = item.stockRecords.out.reduce(
    (total, record) => total + toNumber(record.amount),
    0,
  );

  return {
    currentPrice: item.stockRecords.in.at(-1)?.refSellPrice || "0",
    inStock: incoming - outgoing,
    sold: outgoing,
  };
}

export function getLatestRecords(
  item: Item,
  limit: number,
): StockRecordPreview[] {
  const inbound = item.stockRecords.in.map((record, index) => ({
    kind: "in" as const,
    date: record.date,
    amount: record.amount,
    priceLabel: "參考售價",
    price: record.refSellPrice,
    sequence: index,
  }));

  const outbound = item.stockRecords.out.map((record, index) => ({
    kind: "out" as const,
    date: record.date,
    amount: record.amount,
    priceLabel: "售價",
    price: record.price,
    sequence: item.stockRecords.in.length + index,
  }));

  return [...inbound, ...outbound]
    .sort((a, b) => b.sequence - a.sequence)
    .slice(0, limit)
    .map(({ sequence: _sequence, ...record }) => record);
}

export function hasEnoughStock(item: Item, update: RecordUpdate, mode: 1 | -1) {
  const metrics = getItemMetrics(item);
  const incomingDelta = update.ins ? toNumber(update.ins.amount) * mode : 0;
  const outgoingDelta = update.outs ? toNumber(update.outs.amount) * mode : 0;
  return metrics.inStock + incomingDelta - outgoingDelta >= 0;
}

export function validateRecord(
  item: Item,
  update: RecordUpdate,
  mode: 1 | -1 = 1,
) {
  const errors: string[] = [];
  const record = update.ins ?? update.outs;
  const datePattern = /^(0[1-9]|1[0-2])\/([0-9]{2})$/;
  const amountPattern = /^[1-9][0-9]*$/;
  const moneyPattern = /^(0|[1-9]\d*)(\.\d{1,2})?$/;

  if (!hasEnoughStock(item, update, mode)) {
    errors.push("出入貨數量不正確，出貨後存貨不可少於 0。");
  }

  if (record) {
    if (!datePattern.test(record.date)) errors.push("日期格式請使用 MM/YY。");
    if (!amountPattern.test(record.amount)) errors.push("數量必須是正整數。");
  }

  if (update.ins) {
    if (!moneyPattern.test(update.ins.cost)) errors.push("入貨價格式不正確。");
    if (!moneyPattern.test(update.ins.refSellPrice)) {
      errors.push("參考售價格式不正確。");
    }
  }

  if (update.outs && !moneyPattern.test(update.outs.price)) {
    errors.push("售價格式不正確。");
  }

  return errors;
}

export function latestInboundTemplate(records: StockInRecord[]): StockInRecord {
  return records.at(-1)
    ? { ...records.at(-1)! }
    : { date: "", amount: "1", cost: "0", refSellPrice: "0" };
}

export function latestOutboundTemplate(records: StockInRecord[]): StockOutRecord {
  const latestIn = records.at(-1);
  return {
    date: "",
    amount: "1",
    price: latestIn?.refSellPrice || "0",
  };
}
