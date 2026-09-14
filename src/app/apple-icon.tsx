import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 180,
          height: 180,
          background: "#0D0D0F",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <span
          style={{
            color: "#CAFF4D",
            fontSize: 104,
            fontWeight: 700,
            lineHeight: 1,
          }}
        >
          筋
        </span>
      </div>
    ),
    { width: 180, height: 180 }
  );
}
