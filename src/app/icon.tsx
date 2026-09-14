import { ImageResponse } from "next/og";

export const size = { width: 192, height: 192 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 192,
          height: 192,
          background: "#0D0D0F",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 40,
        }}
      >
        <span
          style={{
            color: "#CAFF4D",
            fontSize: 110,
            fontWeight: 700,
            lineHeight: 1,
          }}
        >
          筋
        </span>
      </div>
    ),
    { width: 192, height: 192 }
  );
}
