"use client";

export default function RouteError({ error, reset }: { error: Error; reset: () => void }) {
  const isChunkError = /ChunkLoadError|Loading chunk|Failed to fetch dynamically imported module/i.test(`${error.name} ${error.message}`);
  return (
    <div role="alert" className="max-w-xl mx-auto py-16 space-y-4 text-studio-200">
      <h1 className="text-xl font-bold">{isChunkError ? "An updated page is available" : "This page could not load"}</h1>
      <p className="text-sm text-studio-400">{isChunkError ? "Reload to get the current page files. Your saved songs and generation jobs remain available." : "Please try again. Your saved songs remain in your library."}</p>
      <button onClick={() => isChunkError ? window.location.reload() : reset()} className="px-4 py-2 rounded-xl bg-neon-cyan text-studio-950 text-sm font-semibold">{isChunkError ? "Reload page" : "Try again"}</button>
    </div>
  );
}
