import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen">
      <nav className="flex items-center justify-between p-6">
        <Link href="/" className="text-lg hover:opacity-70 transition-opacity">
          ambient analytics
        </Link>
        <div className="flex gap-6">
          <Link href="/experiments" className="text-lg hover:opacity-70 transition-opacity">
            experiments
          </Link>
          <Link href="/config" className="text-lg hover:opacity-70 transition-opacity">
            config
          </Link>
        </div>
      </nav>
      <div className="flex items-center justify-center" style={{ minHeight: 'calc(100vh - 72px)' }}>
        <h1 className="text-4xl">ambient analytics</h1>
      </div>
    </div>
  );
}
