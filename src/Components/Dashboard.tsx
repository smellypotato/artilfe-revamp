import { useEffect, useState } from "react";
import "../Styles/Dashboard.css";
import { InventoryContainer } from "./InventoryContainer";
import { supabaseEdgeInventoryRepository } from "../services/supabaseEdgeInventoryRepository";
import type { Category } from "../types/inventory";

export function Dashboard() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [status, setStatus] = useState("載入類別中...");

  useEffect(() => {
    let isMounted = true;

    supabaseEdgeInventoryRepository
      .getCategories()
      .then((types) => {
        if (!isMounted) return;
        setCategories(types);
        setStatus(types.length ? "" : "尚未設定類別。");
      })
      .catch((error) => {
        console.error("Unable to load categories", error);
        if (isMounted) setStatus("暫時未能載入類別，請稍後再試。");
      });

    return () => {
      isMounted = false;
    };
  }, []);

  if (selectedCategory) {
    return (
      <InventoryContainer
        type={selectedCategory.key}
        label={selectedCategory.label}
        onReturn={() => setSelectedCategory(null)}
      />
    );
  }

  return (
    <main className="Dashboard">
      <section className="DashboardHero">
        <p className="Eyebrow">Artfile Inventory</p>
        <h1>庫存總覽</h1>
        <p>
          選擇類別後即可查看作品、現貨數量與最新出入貨紀錄。介面保持簡單，
          方便日常快速查找。
        </p>
      </section>

      <section className="CategoryPanel" aria-labelledby="category-title">
        <div>
          <p className="Eyebrow">類別</p>
          <h2 id="category-title">請選擇庫存類別</h2>
        </div>

        {status ? (
          <p className="Muted">{status}</p>
        ) : (
          <div className="CategoryGrid">
            {categories.map((category) => (
              <button
                type="button"
                className="CategoryButton"
                onClick={() => setSelectedCategory(category)}
                key={category.key}
              >
                <span>{category.label}</span>
                <small>查看庫存</small>
              </button>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
