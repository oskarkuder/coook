import Link from "next/link";

export default function NotFound() {
  return (
    <div className="page">
      <h1 className="h1">Page not found</h1>
      <p className="meta mt-2">That link does not lead anywhere.</p>
      <Link href="/" className="btn-primary mt-8 sm:w-48">
        Back to Coook!
      </Link>
    </div>
  );
}
