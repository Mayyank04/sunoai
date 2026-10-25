import React from "react";

export const Skeleton: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  className = "",
  ...props
}) => {
  return (
    <div
      className={`animate-pulse bg-studio-800/60 rounded-xl ${className}`}
      {...props}
    />
  );
};

export const SongCardSkeleton: React.FC = () => {
  return (
    <div className="bg-studio-900 border border-studio-800 rounded-2xl p-5 space-y-4">
      <Skeleton className="aspect-square w-full rounded-xl" />
      <div className="space-y-2">
        <Skeleton className="h-4 w-3/4 rounded-md" />
        <Skeleton className="h-3 w-1/2 rounded-md" />
      </div>
      <div className="pt-2 flex justify-between items-center">
        <Skeleton className="h-5 w-24 rounded-full" />
        <Skeleton className="h-6 w-6 rounded-md" />
      </div>
    </div>
  );
};
