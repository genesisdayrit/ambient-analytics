import Link from "next/link";

export default function NaturalLanguageToSQL() {
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
      <div className="p-6">
        <h1 className="text-4xl mb-8">natural language to sql</h1>
        <p className="text-gray-600 dark:text-gray-400">Placeholder page - coming soon</p>
      </div>
    </div>
  );
}
