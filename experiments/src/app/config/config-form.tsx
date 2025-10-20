"use client";

import { useState } from "react";

export default function ConfigForm() {
  const [postgresUrl, setPostgresUrl] = useState("");

  return (
    <div className="border border-gray-300 dark:border-gray-700 rounded-lg p-6">
      <h2 className="text-2xl mb-4">In-Memory Configuration</h2>
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
        These values are stored in memory and will reset on page refresh.
      </p>
      
      <div className="space-y-4">
        <div className="space-y-2">
          <label htmlFor="postgres-url" className="block text-sm font-medium">
            Postgres URL
          </label>
          <input
            id="postgres-url"
            type="text"
            value={postgresUrl}
            onChange={(e) => setPostgresUrl(e.target.value)}
            placeholder="postgresql://username:password@host:port/database"
            className="w-full p-3 border border-gray-300 dark:border-gray-700 rounded bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        
        {postgresUrl && (
          <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded border border-blue-200 dark:border-blue-800">
            <p className="text-sm text-blue-800 dark:text-blue-200">
              ✓ Postgres URL stored in memory
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

