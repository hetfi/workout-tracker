export default function DayLoading() {
  return (
    <div className="py-6 space-y-5">
      {/* Back link skeleton */}
      <div className="h-5 w-14 rounded-md bg-white/10 animate-pulse" />
      {/* Date title skeleton */}
      <div className="h-7 w-52 rounded-md bg-white/10 animate-pulse" />
      {/* Content card skeleton */}
      <div
        className="rounded-xl p-4 space-y-4"
        style={{ backgroundColor: "#2C2C2E", border: "1px solid rgba(255,255,255,0.08)" }}
      >
        <div className="flex items-center justify-between">
          <div className="h-5 w-36 rounded-md bg-white/10 animate-pulse" />
          <div className="h-5 w-12 rounded-full bg-white/10 animate-pulse" />
        </div>
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-white/20 animate-pulse" />
            <div className="h-4 w-16 rounded bg-white/10 animate-pulse" />
          </div>
          <div className="pl-4 space-y-1.5">
            <div className="h-4 w-full rounded bg-white/10 animate-pulse" />
            <div className="h-4 w-3/4 rounded bg-white/10 animate-pulse" />
          </div>
        </div>
        <div className="h-9 w-full rounded-xl bg-white/10 animate-pulse" />
      </div>
    </div>
  );
}
