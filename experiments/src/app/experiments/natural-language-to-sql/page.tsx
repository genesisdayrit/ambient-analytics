"use client";

import Link from "next/link";
import { useState } from "react";

export default function NaturalLanguageToSQL() {
  const [selectedEnv, setSelectedEnv] = useState("");

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
      <div className="p-6 max-w-4xl">
        <h1 className="text-4xl mb-8">natural language to sql</h1>
        
        <div className="mb-6">
          <label htmlFor="env-selector" className="block text-sm mb-2">
            Select Demo Environment
          </label>
          <select
            id="env-selector"
            value={selectedEnv}
            onChange={(e) => setSelectedEnv(e.target.value)}
            className="w-full max-w-md px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-400"
          >
            <option value="">Select an environment...</option>
            <option value="demo-postgres">Demo Postgres URL</option>
          </select>
        </div>
      </div>
    </div>
  );
}

