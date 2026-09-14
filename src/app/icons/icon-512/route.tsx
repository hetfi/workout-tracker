import { ImageResponse } from "next/og";

export const runtime = "edge";

export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 512,
          height: 512,
          background: "#0D0D0F",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <span
          style={{
            color: "#CAFF4D",
            fontSize: 290,
            fontWeight: 700,
            lineHeight: 1,
          }}
        >
          筋
        </span>
      </div>
    ),
    { width: 512, height: 512 }
  );
}
