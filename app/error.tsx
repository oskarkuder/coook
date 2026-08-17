"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="page">
      <h1 className="h1">Something went wrong</h1>
      <p className="meta mt-2">
        {error.message || "An unexpected error happened."}
      </p>
      <button type="button" className="btn-primary mt-8 sm:w-48" onClick={reset}>
        Try again
      </button>
    </div>
  );
}
