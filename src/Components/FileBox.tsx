import { useRef, useState, type ChangeEvent, type DragEvent, type RefObject } from "react";
import "../Styles/FileBox.css";

interface FileBoxProps {
  onChange?: (event: ChangeEvent<HTMLInputElement>) => void;
  onDrop?: (file: File) => void;
  refer?: RefObject<HTMLInputElement | null>;
  image?: string;
  alt?: string;
}

export default function FileBox({
  onChange,
  onDrop,
  refer,
  image = "",
  alt = "作品圖片",
}: FileBoxProps) {
  const [isDragging, setIsDragging] = useState(false);
  const dragCounter = useRef(0);

  const stopDrag = (event: DragEvent<HTMLDivElement>) => {
    event.stopPropagation();
    event.preventDefault();
  };

  const handleDragEnter = (event: DragEvent<HTMLDivElement>) => {
    stopDrag(event);
    dragCounter.current += 1;
    setIsDragging(true);
  };

  const handleDragLeave = (event: DragEvent<HTMLDivElement>) => {
    stopDrag(event);
    dragCounter.current -= 1;
    if (dragCounter.current <= 0) setIsDragging(false);
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    stopDrag(event);
    dragCounter.current = 0;
    setIsDragging(false);

    const file = event.dataTransfer.files?.[0];
    if (file) onDrop?.(file);
    event.dataTransfer.clearData();
  };

  return (
    <div
      className={`FileBox${isDragging ? " dragging" : ""}`}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={stopDrag}
      onDrop={handleDrop}
    >
      {image ? (
        <img className="FileImage" src={image} alt={alt} />
      ) : (
        <label className="FileInput">
          <span>上載圖片</span>
          {refer ? (
            <input
              className="UploadInput"
              type="file"
              accept="image/*"
              ref={refer}
              onChange={onChange}
            />
          ) : null}
        </label>
      )}
    </div>
  );
}
