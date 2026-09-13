export default function ExercisesLoading() {
  return (
    <div className="py-6 space-y-4 animate-pulse">
      <div className="h-8 bg-gray-200 dark:bg-gray-800 rounded-xl w-40" />
      <div className="space-y-2">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-16 bg-gray-200 dark:bg-gray-800 rounded-2xl" />
        ))}
      </div>
    </div>
  );
}
