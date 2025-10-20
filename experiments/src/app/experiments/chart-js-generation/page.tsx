"use client";

import { useState } from "react";

export default function ChartJSGeneration() {
  const [selectedEnv, setSelectedEnv] = useState("");

  return (
    <div className="min-h-screen">
      <div className="p-6">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-4xl mb-8">chart.js generation</h1>
          
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
    </div>
  );
}

