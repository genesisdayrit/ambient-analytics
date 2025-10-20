import Link from "next/link";
import ConfigForm from "./config-form";

export default function Config() {
  const demoPostgresUrl = process.env.DEMO_POSTGRES_DATABASE_URL || "Not set";

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
      <div className="p-6 max-w-4xl mx-auto">
        <h1 className="text-4xl mb-8">config</h1>
        
        <div className="space-y-8">
          {/* Environment Variable Display */}
          <div className="border border-gray-300 dark:border-gray-700 rounded-lg p-6">
            <h2 className="text-2xl mb-4">Environment Variables</h2>
            <div className="space-y-2">
              <label className="text-sm text-gray-600 dark:text-gray-400">
                DEMO_POSTGRES_DATABASE_URL
              </label>
              <div className="p-3 bg-gray-100 dark:bg-gray-800 rounded border border-gray-300 dark:border-gray-700 font-mono text-sm break-all">
                {demoPostgresUrl}
              </div>
            </div>
          </div>

          {/* In-Memory Config */}
          <ConfigForm />
        </div>
      </div>
    </div>
  );
}

