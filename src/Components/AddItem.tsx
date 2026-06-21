import "../Styles/Item.css";

export function AddItem({ openPopup }: { openPopup: () => void }) {
  return (
    <article className="ItemContainer">
      <button type="button" className="AddItem" onClick={openPopup}>
        <span>+</span>
        新增作品
      </button>
    </article>
  );
}
