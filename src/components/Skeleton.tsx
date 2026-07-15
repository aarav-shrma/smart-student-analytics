type Props = {
  className?: string;
};

export function Skeleton({ className = '' }: Props) {
  return (
    <div
      className={`bg-gray-200 rounded animate-pulse ${className}`}
      role="status"
      aria-label="Loading"
    />
  );
}

/**
 * A card-shaped skeleton, matches CourseCard and StatCard dimensions.
 */
export function CardSkeleton() {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
      <Skeleton className="h-3 w-16 mb-2" />
      <Skeleton className="h-5 w-40 mb-4" />
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Skeleton className="h-3 w-20 mb-1" />
          <Skeleton className="h-6 w-16" />
        </div>
        <div>
          <Skeleton className="h-3 w-20 mb-1" />
          <Skeleton className="h-6 w-16" />
        </div>
      </div>
    </div>
  );
}

/**
 * A grid of skeleton cards for the dashboard loading state.
 */
export function DashboardSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      {/* Stat card row */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
            <Skeleton className="h-3 w-24 mb-2" />
            <Skeleton className="h-8 w-20" />
          </div>
        ))}
      </section>

      {/* Content skeleton */}
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: count }).map((_, i) => <CardSkeleton key={i} />)}
      </section>
    </div>
  );
}