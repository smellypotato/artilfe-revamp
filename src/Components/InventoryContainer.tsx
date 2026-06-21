import { useEffect, useMemo, useState } from "react";
import "../Styles/InventoryContainer.css";
import { Item } from "./Item";
import { AddItem } from "./AddItem";
import { DetailedInfo } from "./DetailedInfo";
import { supabaseEdgeInventoryRepository } from "../services/supabaseEdgeInventoryRepository";
import type { Item as InventoryItem, RecordUpdate } from "../types/inventory";
import { emptyItem, getItemMetrics } from "../utils/inventory";

type DetailMode = "NEW" | "DETAIL" | "EDIT";

interface InventoryContainerProps {
  type: string;
  label: string;
  onReturn: () => void;
}

export function InventoryContainer({ type, label, onReturn }: InventoryContainerProps) {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [detailMode, setDetailMode] = useState<DetailMode>("DETAIL");
  const [status, setStatus] = useState("載入庫存中...");

  useEffect(() => {
    setStatus("載入庫存中...");

    const unsubscribe = supabaseEdgeInventoryRepository.subscribeItems(type, (nextItems) => {
      setItems(nextItems);
      setStatus("");
    });

    return unsubscribe;
  }, [type]);

  const summary = useMemo(() => {
    return items.reduce(
      (accumulator, item) => {
        const metrics = getItemMetrics(item);
        return {
          total: accumulator.total + 1,
          inStock: accumulator.inStock + metrics.inStock,
          sold: accumulator.sold + metrics.sold,
        };
      },
      { total: 0, inStock: 0, sold: 0 },
    );
  }, [items]);

  const openDetail = (item: InventoryItem, mode: DetailMode) => {
    setSelectedItem(item);
    setDetailMode(mode);
  };

  const closeDetail = () => {
    setSelectedItem(null);
    setDetailMode("DETAIL");
  };

  const handleAddItem = async (newItem: InventoryItem, imageFile?: File | null) => {
    return supabaseEdgeInventoryRepository.addItem(type, newItem, imageFile);
  };

  const handleEditItem = async (
    editedItem: InventoryItem,
    imageFile?: File | null,
  ) => {
    await supabaseEdgeInventoryRepository.editItem(type, editedItem, imageFile);
  };

  const handleDeleteItem = async (deleteItem: InventoryItem) => {
    await supabaseEdgeInventoryRepository.deleteItem(type, deleteItem);
    closeDetail();
  };

  const handleAddRecord = async (item: InventoryItem, update: RecordUpdate) => {
    await supabaseEdgeInventoryRepository.updateRecord(type, item, update);
  };

  const handleRemoveRecord = async (
    stockType: "in" | "out",
    key: number,
    item: InventoryItem,
  ) => {
    await supabaseEdgeInventoryRepository.removeRecord(type, item, stockType, key);
  };

  return (
    <main className="InventoryPage">
      <header className="InventoryHeader">
        <button type="button" className="GhostButton" onClick={onReturn}>
          返回類別
        </button>
        <div>
          <p className="Eyebrow">目前類別</p>
          <h1>{label}</h1>
        </div>
      </header>

      <section className="InventorySummary" aria-label="庫存摘要">
        <div>
          <span>{summary.total}</span>
          <small>作品</small>
        </div>
        <div>
          <span>{summary.inStock}</span>
          <small>現貨</small>
        </div>
        <div>
          <span>{summary.sold}</span>
          <small>售出</small>
        </div>
      </section>

      {status ? <p className="Muted">{status}</p> : null}

      <section className="InventoryGrid">
        {items.map((item) => (
          <Item
            item={item}
            key={item.id}
            openPopup={() => openDetail(item, "DETAIL")}
          />
        ))}
        <AddItem openPopup={() => openDetail(emptyItem(), "NEW")} />
      </section>

      {selectedItem ? (
        <DetailedInfo
          onClose={closeDetail}
          itemInfo={selectedItem}
          mode={detailMode}
          onAddItem={handleAddItem}
          onRemoveRecord={handleRemoveRecord}
          onEditItem={handleEditItem}
          onDeleteItem={handleDeleteItem}
          onAddRecord={handleAddRecord}
        />
      ) : null}
    </main>
  );
}
