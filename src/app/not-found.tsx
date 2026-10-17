import Link from 'next/link';
export default function NotFound() {
  return (
    <main className="not-found">
      <div className="brand-mark">m</div>
      <h1>This page is unavailable.</h1>
      <p>Return to your workspace to continue.</p>
      <Link className="button primary" href="/patient/overview">
        Open workspace
      </Link>
    </main>
  );
}
