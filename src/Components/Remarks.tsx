import type { ChangeEvent, MouseEvent } from "react";
import "../Styles/Remarks.css";

interface RemarksProps {
  content: string;
  onInputChange?: (event: ChangeEvent<HTMLTextAreaElement>) => void;
}

export default function Remarks({ content, onInputChange }: RemarksProps) {
  const stopClick = (event: MouseEvent<HTMLDivElement>) => {
    event.stopPropagation();
  };

  return (
    <section className="Remarks" onClick={stopClick}>
      <h2>備註</h2>
      {onInputChange ? (
        <textarea
          className="RemarkTextarea"
          name="remarks"
          value={content}
          onChange={onInputChange}
          placeholder="輸入備註..."
        />
      ) : (
        <p className="RemarkText">{content || "未有備註"}</p>
      )}
    </section>
  );
}
