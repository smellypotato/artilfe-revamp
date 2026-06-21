import { useMemo, useState, type ChangeEvent, type FormEvent } from "react";
import Record from "./Record";
import "../Styles/StockRecord.css";
import type {
  Item,
  RecordUpdate,
  StockInRecord,
  StockOutRecord,
} from "../types/inventory";
import {
  latestInboundTemplate,
  latestOutboundTemplate,
  validateRecord,
} from "../utils/inventory";

interface StockRecordProps {
  item: Item;
  onAddRecord: (record: RecordUpdate) => Promise<void> | void;
  onRemoveRecord: (stockType: "in" | "out", key: number) => Promise<void> | void;
}

export default function StockRecord({
  item,
  onAddRecord,
  onRemoveRecord,
}: StockRecordProps) {
  const [inForm, setInForm] = useState<StockInRecord>(() =>
    latestInboundTemplate(item.stockRecords.in),
  );
  const [outForm, setOutForm] = useState<StockOutRecord>(() =>
    latestOutboundTemplate(item.stockRecords.in),
  );
  const [isSaving, setIsSaving] = useState(false);

  const combinedRecords = useMemo(() => {
    const inbound = item.stockRecords.in.map((record, index) => ({
      kind: "in" as const,
      record,
      index,
      sequence: index,
    }));
    const outbound = item.stockRecords.out.map((record, index) => ({
      kind: "out" as const,
      record,
      index,
      sequence: item.stockRecords.in.length + index,
    }));

    return [...inbound, ...outbound].sort((a, b) => b.sequence - a.sequence);
  }, [item.stockRecords.in, item.stockRecords.out]);

  const handleInChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;
    setInForm((current) => ({ ...current, [name]: value }));
  };

  const handleOutChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;
    setOutForm((current) => ({ ...current, [name]: value }));
  };

  const submitRecord = async (event: FormEvent, update: RecordUpdate) => {
    event.preventDefault();
    const errors = validateRecord(item, update);

    if (errors.length) {
      alert(errors.join("\n"));
      return;
    }

    setIsSaving(true);
    try {
      await onAddRecord(update);
      if (update.ins) setInForm(latestInboundTemplate([...item.stockRecords.in, update.ins]));
      if (update.outs) setOutForm(latestOutboundTemplate(item.stockRecords.in));
    } finally {
      setIsSaving(false);
    }
  };

  const removeRecord = async (stockType: "in" | "out", index: number) => {
    const update =
      stockType === "in"
        ? { ins: item.stockRecords.in[index] }
        : { outs: item.stockRecords.out[index] };
    const errors = validateRecord(item, update, -1);

    if (errors.length) {
      alert(errors.join("\n"));
      return;
    }

    await onRemoveRecord(stockType, index);
  };

  return (
    <section className="StockRecord" onClick={(event) => event.stopPropagation()}>
      <div className="StockRecordHeader">
        <h2>出入貨紀錄</h2>
        <p>新增紀錄後會即時更新現貨與最新紀錄。</p>
      </div>

      <div className="RecordForms">
        <form className="RecordForm" onSubmit={(event) => submitRecord(event, { ins: inForm })}>
          <h3>新增入貨</h3>
          <label>
            日期
            <input name="date" value={inForm.date} onChange={handleInChange} placeholder="MM/YY" />
          </label>
          <label>
            數量
            <input name="amount" value={inForm.amount} onChange={handleInChange} inputMode="numeric" />
          </label>
          <label>
            入貨價
            <input name="cost" value={inForm.cost} onChange={handleInChange} inputMode="decimal" />
          </label>
          <label>
            參考售價
            <input name="refSellPrice" value={inForm.refSellPrice} onChange={handleInChange} inputMode="decimal" />
          </label>
          <button type="submit" disabled={isSaving}>加入入貨</button>
        </form>

        <form className="RecordForm" onSubmit={(event) => submitRecord(event, { outs: outForm })}>
          <h3>新增出貨</h3>
          <label>
            日期
            <input name="date" value={outForm.date} onChange={handleOutChange} placeholder="MM/YY" />
          </label>
          <label>
            數量
            <input name="amount" value={outForm.amount} onChange={handleOutChange} inputMode="numeric" />
          </label>
          <label>
            售價
            <input name="price" value={outForm.price} onChange={handleOutChange} inputMode="decimal" />
          </label>
          <button type="submit" disabled={isSaving}>加入出貨</button>
        </form>
      </div>

      <div className="RecordTableWrap">
        <table className="RecordTable">
          <thead>
            <tr>
              <th>類型</th>
              <th>日期</th>
              <th>數量</th>
              <th>價格</th>
              <th>參考售價</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {combinedRecords.length ? (
              combinedRecords.map(({ kind, record, index, sequence }) => (
                <Record
                  kind={kind}
                  record={record}
                  key={`${kind}-${sequence}`}
                  onRemove={() => removeRecord(kind, index)}
                />
              ))
            ) : (
              <tr>
                <td colSpan={6}>尚未有紀錄</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
