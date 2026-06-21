import "../Styles/Item.css";
import { appConfig } from "../config";
import type { Item as InventoryItem } from "../types/inventory";
import { getItemMetrics, getLatestRecords } from "../utils/inventory";

interface ItemProps {
  item: InventoryItem;
  openPopup: () => void;
}

export function Item({ item, openPopup }: ItemProps) {
  const metrics = getItemMetrics(item);
  const latestRecords = getLatestRecords(item, appConfig.recordPreviewLimit);

  return (
    <article className="ItemContainer">
      <button type="button" className="ItemCard" onClick={openPopup}>
        <div className="ItemImage">
          {item.img ? (
            <img src={item.img} alt={item.name || item.id || "作品圖片"} />
          ) : (
            <span>未有圖片</span>
          )}
        </div>

        <div className="ItemInfo">
          <div>
            <p className="ItemId">{item.id || "未有編號"}</p>
            <h2>{item.name || "未命名作品"}</h2>
          </div>

          <dl className="MetricGrid">
            <div>
              <dt>現價</dt>
              <dd>${metrics.currentPrice}</dd>
            </div>
            <div>
              <dt>現貨</dt>
              <dd>{metrics.inStock}</dd>
            </div>
            <div>
              <dt>售出</dt>
              <dd>{metrics.sold}</dd>
            </div>
          </dl>

          <div className="ItemMeta">
            <span>{item.source || "來源未填"}</span>
            <span>{item.material || "材料未填"}</span>
            <span>{item.size || "尺寸未填"}</span>
          </div>

          <div className="LatestRecords">
            <div className="LatestRecordsHeader">
              <strong>最新紀錄</strong>
              <small>最近 {appConfig.recordPreviewLimit} 筆</small>
            </div>
            {latestRecords.length ? (
              latestRecords.map((record, index) => (
                <div className="LatestRecordRow" key={`${record.kind}-${index}`}>
                  <span className={`RecordPill ${record.kind}`}>
                    {record.kind === "in" ? "入貨" : "出貨"}
                  </span>
                  <span>{record.date}</span>
                  <span>{record.amount} 件</span>
                  <span>${record.price}</span>
                </div>
              ))
            ) : (
              <p className="NoRecords">尚未有出入貨紀錄</p>
            )}
          </div>
        </div>
      </button>
    </article>
  );
}
