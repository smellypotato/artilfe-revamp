import { useEffect, useRef, useState, type ChangeEvent } from "react";
import "../Styles/DetailedInfo.css";
import "../Styles/Item.css";
import FileBox from "./FileBox";
import StockRecord from "./StockRecord";
import Remarks from "./Remarks";
import type { Item, RecordUpdate } from "../types/inventory";
import { getItemMetrics } from "../utils/inventory";

type DetailMode = "NEW" | "DETAIL" | "EDIT";

interface DetailedInfoProps {
  itemInfo: Item;
  onClose: () => void;
  mode: DetailMode;
  onAddItem: (item: Item, imageFile?: File | null) => Promise<boolean>;
  onEditItem: (item: Item, imageFile?: File | null) => Promise<void>;
  onDeleteItem: (item: Item) => Promise<void>;
  onAddRecord: (item: Item, record: RecordUpdate) => Promise<void>;
  onRemoveRecord: (
    stockType: "in" | "out",
    key: number,
    item: Item,
  ) => Promise<void>;
}

export function DetailedInfo({
  itemInfo,
  onClose,
  mode,
  onAddItem,
  onEditItem,
  onDeleteItem,
  onAddRecord,
  onRemoveRecord,
}: DetailedInfoProps) {
  const [item, setItem] = useState<Item>(itemInfo);
  const [currentMode, setCurrentMode] = useState<DetailMode>(mode);
  const [file, setFile] = useState<File | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setItem(itemInfo);
    setCurrentMode(mode);
    setFile(null);
  }, [itemInfo, mode]);

  const metrics = getItemMetrics(item);
  const isEditable = currentMode === "NEW" || currentMode === "EDIT";

  const updateField = (
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const { name, value } = event.target;
    setItem((current) => ({ ...current, [name]: value }));
  };

  const updateItemWithFile = (nextFile: File) => {
    setFile(nextFile);
    setItem((current) => ({ ...current, img: URL.createObjectURL(nextFile) }));
  };

  const handleFileInput = () => {
    const nextFile = fileInputRef.current?.files?.[0];
    if (nextFile) updateItemWithFile(nextFile);
  };

  const handleConfirm = async () => {
    if (!item.id?.trim()) {
      alert("未輸入編號。");
      return;
    }

    setIsSaving(true);
    try {
      if (currentMode === "NEW") {
        const added = await onAddItem(item, file);
        if (!added) {
          alert("編號已存在。");
          return;
        }
      } else {
        await onEditItem(item, file);
      }
      setCurrentMode("DETAIL");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm("確定要刪除此作品？")) return;
    await onDeleteItem(item);
  };

  const handleAddRecord = async (record: RecordUpdate) => {
    await onAddRecord(item, record);
  };

  const handleRemoveRecord = async (stockType: "in" | "out", key: number) => {
    await onRemoveRecord(stockType, key, item);
  };

  return (
    <div className="DetailedInfo" onClick={onClose}>
      <div className="DetailShell" onClick={(event) => event.stopPropagation()}>
        <header className="DetailHeader">
          <div>
            <p className="Eyebrow">
              {currentMode === "NEW" ? "新增作品" : item.id || "作品詳情"}
            </p>
            <h1>{item.name || "未命名作品"}</h1>
          </div>
          <button type="button" className="IconButton" onClick={onClose}>
            關閉
          </button>
        </header>

        <div className="DetailContent">
          <section className="DetailPanel">
            <div className="DetailImage">
              <FileBox
                image={item.img}
                alt={item.name || item.id || "作品圖片"}
                refer={fileInputRef}
                onChange={handleFileInput}
                onDrop={updateItemWithFile}
              />
              {isEditable && item.img ? (
                <button
                  type="button"
                  className="GhostButton"
                  onClick={() => setItem((current) => ({ ...current, img: "" }))}
                >
                  移除圖片
                </button>
              ) : null}
            </div>

            <div className="DetailFields">
              {[
                ["name", "名稱"],
                ["id", "編號"],
                ["source", "來源"],
                ["size", "尺寸"],
                ["weight", "重量"],
                ["material", "材料"],
              ].map(([name, label]) => (
                <label key={name}>
                  {label}
                  {isEditable && !(currentMode === "EDIT" && name === "id") ? (
                    <input
                      name={name}
                      value={String(item[name as keyof Item] ?? "")}
                      onChange={updateField}
                      autoComplete="off"
                    />
                  ) : (
                    <span>{String(item[name as keyof Item] || "-")}</span>
                  )}
                </label>
              ))}

              <div className="DetailMetrics">
                <div>
                  <span>{metrics.currentPrice}</span>
                  <small>現價</small>
                </div>
                <div>
                  <span>{metrics.inStock}</span>
                  <small>現貨</small>
                </div>
                <div>
                  <span>{metrics.sold}</span>
                  <small>售出</small>
                </div>
              </div>

              <div className="DetailActions">
                {isEditable ? (
                  <>
                    <button type="button" onClick={handleConfirm} disabled={isSaving}>
                      儲存
                    </button>
                    <button
                      type="button"
                      className="GhostButton"
                      onClick={() => {
                        setItem(itemInfo);
                        setCurrentMode("DETAIL");
                      }}
                    >
                      取消
                    </button>
                  </>
                ) : (
                  <>
                    <button type="button" onClick={() => setCurrentMode("EDIT")}>
                      編輯
                    </button>
                    <button type="button" className="DangerButton" onClick={handleDelete}>
                      刪除
                    </button>
                  </>
                )}
              </div>
            </div>
          </section>

          {currentMode !== "NEW" ? (
            <StockRecord
              item={item}
              onAddRecord={handleAddRecord}
              onRemoveRecord={handleRemoveRecord}
            />
          ) : null}

          {currentMode !== "NEW" ? (
            <Remarks
              content={item.remarks}
              onInputChange={isEditable ? updateField : undefined}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
