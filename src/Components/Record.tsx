import "../Styles/StockRecord.css";
import type { StockInRecord, StockOutRecord, StockRecordKind } from "../types/inventory";

interface RecordProps {
  kind: StockRecordKind;
  record: StockInRecord | StockOutRecord;
  onRemove: () => void;
}

export default function Record({ kind, record, onRemove }: RecordProps) {
  return (
    <tr className="Record">
      <td>{kind === "in" ? "入貨" : "出貨"}</td>
      <td>{record.date}</td>
      <td>{record.amount}</td>
      <td>
        {kind === "in"
          ? (record as StockInRecord).cost
          : (record as StockOutRecord).price}
      </td>
      <td>
        {kind === "in" ? (record as StockInRecord).refSellPrice : "-"}
      </td>
      <td>
        <button type="button" className="SmallBtn" onClick={onRemove}>
          刪除
        </button>
      </td>
    </tr>
  );
}
