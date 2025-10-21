"use client";

import { useState } from "react";

interface EvaluationResult {
  success: boolean;
  message?: string;
  datasetId?: string;
  datasetName?: string;
  error?: string;
  results?: {
    experimentPrefix: string;
    message: string;
  };
}

interface ConfigStatus {
  status: string;
  configuration: {
    langsmithConfigured: boolean;
    openaiConfigured: boolean;
    langsmithEndpoint: string;
    tracingEnabled: boolean;
  };
}

export default function LangSmithEvaluations() {
  const [loading, setLoading] = useState(false);
  const [configStatus, setConfigStatus] = useState<ConfigStatus | null>(null);
  const [result, setResult] = useState<EvaluationResult | null>(null);
  const [datasetName, setDatasetName] = useState("SQL Generation Test Dataset");
  const [experimentPrefix, setExperimentPrefix] = useState("sql-eval");

  // Check configuration status
  const checkConfig = async () => {
    try {
      const response = await fetch("/api/evaluate-langsmith");
      const data = await response.json();
      setConfigStatus(data);
    } catch (error) {
      console.error("Error checking config:", error);
    }
  };

  // Run basic evaluation test
  const runBasicEvaluation = async () => {
    setLoading(true);
    setResult(null);
    try {
      const response = await fetch("/api/evaluate-langsmith", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          datasetName: "Basic Q&A Test",
          experimentPrefix: "basic-test",
        }),
      });
      const data = await response.json();
      setResult(data);
    } catch (error) {
      setResult({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setLoading(false);
    }
  };

  // Run SQL-specific evaluation
  const runSQLEvaluation = async () => {
    setLoading(true);
    setResult(null);
    try {
      const response = await fetch("/api/evaluate-sql-generation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          datasetName,
          experimentPrefix,
        }),
      });
      const data = await response.json();
      setResult(data);
    } catch (error) {
      setResult({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setLoading(false);
    }
  };

  // Test traced SQL generation
  const testTracedSQLGeneration = async () => {
    setLoading(true);
    setResult(null);
    try {
      const response = await fetch("/api/generate-sql", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          env: "test",
          schema: "public",
          naturalLanguageQuery: "Show me all users who signed up in the last 30 days",
          schemaContext: [
            {
              table: "users",
              columns: [
                { name: "id", type: "integer", nullable: false },
                { name: "email", type: "varchar", nullable: false },
                { name: "created_at", type: "timestamp", nullable: false },
                { name: "name", type: "varchar", nullable: true },
              ],
            },
          ],
        }),
      });
      const data = await response.json();
      setResult({
        success: true,
        message: "SQL generated with tracing enabled. Check LangSmith UI for trace.",
        results: {
          experimentPrefix: "traced-sql-generation",
          message: `Generated SQL: ${data.sql || data.error}`,
        },
      });
    } catch (error) {
      setResult({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl mb-2">LangSmith Evaluations</h1>
        <p className="text-gray-600 dark:text-gray-400 mb-8">
          Test and evaluate SQL generation with LangSmith observability
        </p>

        {/* Configuration Status */}
        <div className="mb-8 p-6 border border-gray-300 dark:border-gray-700 rounded-lg">
          <h2 className="text-2xl mb-4">Configuration Status</h2>
          <button
            onClick={checkConfig}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors mb-4"
          >
            Check Configuration
          </button>
          {configStatus && (
            <div className="mt-4 space-y-2">
              <div className="flex items-center gap-2">
                <span className="font-semibold">Status:</span>
                <span className={configStatus.status === "ready" ? "text-green-600" : "text-red-600"}>
                  {configStatus.status}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-semibold">LangSmith:</span>
                <span className={configStatus.configuration.langsmithConfigured ? "text-green-600" : "text-red-600"}>
                  {configStatus.configuration.langsmithConfigured ? "✓ Configured" : "✗ Not configured"}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-semibold">OpenAI:</span>
                <span className={configStatus.configuration.openaiConfigured ? "text-green-600" : "text-red-600"}>
                  {configStatus.configuration.openaiConfigured ? "✓ Configured" : "✗ Not configured"}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-semibold">Tracing:</span>
                <span className={configStatus.configuration.tracingEnabled ? "text-green-600" : "text-yellow-600"}>
                  {configStatus.configuration.tracingEnabled ? "✓ Enabled" : "○ Disabled"}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Test Actions */}
        <div className="space-y-6">
          {/* Basic Evaluation */}
          <div className="p-6 border border-gray-300 dark:border-gray-700 rounded-lg">
            <h2 className="text-2xl mb-2">1. Basic Evaluation Test</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Run a simple Q&A evaluation to verify LangSmith integration
            </p>
            <button
              onClick={runBasicEvaluation}
              disabled={loading}
              className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Running..." : "Run Basic Evaluation"}
            </button>
          </div>

          {/* SQL Generation Tracing */}
          <div className="p-6 border border-gray-300 dark:border-gray-700 rounded-lg">
            <h2 className="text-2xl mb-2">2. Test SQL Generation with Tracing</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Generate SQL and view the trace in LangSmith UI
            </p>
            <button
              onClick={testTracedSQLGeneration}
              disabled={loading}
              className="px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Generating..." : "Test SQL Generation"}
            </button>
          </div>

          {/* SQL Evaluation */}
          <div className="p-6 border border-gray-300 dark:border-gray-700 rounded-lg">
            <h2 className="text-2xl mb-2">3. SQL Generation Evaluation</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Run comprehensive evaluations on SQL generation quality
            </p>
            <div className="space-y-3 mb-4">
              <div>
                <label className="block text-sm mb-1">Dataset Name:</label>
                <input
                  type="text"
                  value={datasetName}
                  onChange={(e) => setDatasetName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded bg-white dark:bg-gray-900"
                />
              </div>
              <div>
                <label className="block text-sm mb-1">Experiment Prefix:</label>
                <input
                  type="text"
                  value={experimentPrefix}
                  onChange={(e) => setExperimentPrefix(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded bg-white dark:bg-gray-900"
                />
              </div>
            </div>
            <button
              onClick={runSQLEvaluation}
              disabled={loading}
              className="px-4 py-2 bg-orange-500 text-white rounded hover:bg-orange-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Running..." : "Run SQL Evaluation"}
            </button>
          </div>
        </div>

        {/* Results Display */}
        {result && (
          <div className="mt-8 p-6 border border-gray-300 dark:border-gray-700 rounded-lg">
            <h2 className="text-2xl mb-4">Results</h2>
            <div className={`p-4 rounded ${result.success ? "bg-green-50 dark:bg-green-900/20" : "bg-red-50 dark:bg-red-900/20"}`}>
              {result.success ? (
                <div className="space-y-2">
                  <p className="text-green-800 dark:text-green-200 font-semibold">✓ {result.message}</p>
                  {result.datasetId && (
                    <p className="text-sm text-gray-700 dark:text-gray-300">
                      Dataset ID: <code className="bg-gray-200 dark:bg-gray-800 px-2 py-1 rounded">{result.datasetId}</code>
                    </p>
                  )}
                  {result.datasetName && (
                    <p className="text-sm text-gray-700 dark:text-gray-300">
                      Dataset: {result.datasetName}
                    </p>
                  )}
                  {result.results && (
                    <div className="mt-4 p-3 bg-white dark:bg-gray-800 rounded">
                      <p className="text-sm font-semibold mb-1">Experiment: {result.results.experimentPrefix}</p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">{result.results.message}</p>
                    </div>
                  )}
                  <a
                    href="https://smith.langchain.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors text-sm"
                  >
                    View in LangSmith UI →
                  </a>
                </div>
              ) : (
                <p className="text-red-800 dark:text-red-200">✗ Error: {result.error}</p>
              )}
            </div>
          </div>
        )}

        {/* Documentation */}
        <div className="mt-8 p-6 border border-gray-300 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-900/50">
          <h2 className="text-xl mb-3">What This Does</h2>
          <ul className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
            <li>• <strong>Basic Evaluation:</strong> Tests the LangSmith integration with simple Q&A examples</li>
            <li>• <strong>SQL Tracing:</strong> Generates SQL with full observability - every LLM call is traced and visible in LangSmith</li>
            <li>• <strong>SQL Evaluation:</strong> Runs automated evaluations to measure SQL generation quality, syntax correctness, and semantic accuracy</li>
            <li>• <strong>View Results:</strong> All traces and evaluation results are available in the LangSmith UI for analysis</li>
          </ul>
          <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded">
            <p className="text-sm text-blue-800 dark:text-blue-200">
              💡 <strong>Tip:</strong> Use this to continuously improve your SQL generation prompts by comparing evaluation results across different prompt versions.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

