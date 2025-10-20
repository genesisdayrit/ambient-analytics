import Link from "next/link";

export default function Navbar() {
  return (
    <nav className="flex items-center justify-between px-6 py-4 max-w-screen-2xl mx-auto w-full">
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
  );
}

