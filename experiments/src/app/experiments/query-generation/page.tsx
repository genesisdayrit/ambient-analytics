"use client";

import { useState, useEffect } from "react";
import Script from "next/script";

interface Table {
  name: string;
  type: string;
}

interface Column {
  name: string;
  type: string;
  nullable: boolean;
  default: string | null;
  maxLength: number | null;
}

interface TableWithColumns {
  table: string;
  type: string;
  columns: Column[];
}

interface QueryResult {
  columns: string[];
  rows: Record<string, any>[];
  rowCount: number;
}

interface QuestionResult {
  question: string;
  sql?: string;
  result?: QueryResult;
  interpretation?: string;
  chartConfig?: any;
  error?: string;
  isProcessing: boolean;
  currentStep?: 'generating-sql' | 'executing-sql' | 'interpreting' | 'generating-chart' | 'complete';
  stepStatuses?: {
    sqlGeneration: 'pending' | 'processing' | 'complete' | 'error';
    sqlExecution: 'pending' | 'processing' | 'complete' | 'error';
    interpretation: 'pending' | 'processing' | 'complete' | 'error';
    chartGeneration: 'pending' | 'processing' | 'complete' | 'error';
  };
}

export default function QueryGeneration() {
  const [selectedEnv, setSelectedEnv] = useState("");
  const [schemas, setSchemas] = useState<string[]>([]);
  const [selectedSchema, setSelectedSchema] = useState("");
  const [tables, setTables] = useState<Table[]>([]);
  const [tablesWithColumns, setTablesWithColumns] = useState<TableWithColumns[]>([]);
  const [schemaAnalysis, setSchemaAnalysis] = useState("");
  const [generatedQuestions, setGeneratedQuestions] = useState<string[]>([]);
  const [questionResults, setQuestionResults] = useState<Map<number, QuestionResult>>(new Map());
  const [loading, setLoading] = useState(false);
  const [loadingTables, setLoadingTables] = useState(false);
  const [loadingAllColumns, setLoadingAllColumns] = useState(false);
  const [analyzingSchema, setAnalyzingSchema] = useState(false);
  const [generatingQuestions, setGeneratingQuestions] = useState(false);
  const [error, setError] = useState("");
  const [tablesError, setTablesError] = useState("");
  const [analysisError, setAnalysisError] = useState("");
  const [questionsError, setQuestionsError] = useState("");

  useEffect(() => {
    if (selectedEnv) {
      fetchSchemas(selectedEnv);
    } else {
      setSchemas([]);
      setSelectedSchema("");
      setTables([]);
      setTablesWithColumns([]);
      setSchemaAnalysis("");
      setGeneratedQuestions([]);
    }
  }, [selectedEnv]);

  useEffect(() => {
    if (selectedSchema && selectedEnv) {
      fetchTables(selectedEnv, selectedSchema);
    } else {
      setTables([]);
      setTablesWithColumns([]);
      setSchemaAnalysis("");
      setGeneratedQuestions([]);
      setQuestionResults(new Map());
    }
  }, [selectedSchema, selectedEnv]);

  useEffect(() => {
    if (tables.length > 0 && selectedSchema && selectedEnv) {
      fetchAllColumns(selectedEnv, selectedSchema, tables);
    }
  }, [tables, selectedSchema, selectedEnv]);

  // Render charts when chart configs are available
  useEffect(() => {
    questionResults.forEach((result, idx) => {
      if (result.chartConfig && !result.isProcessing) {
        const canvasId = `chart-${idx}`;
        const canvas = document.getElementById(canvasId) as HTMLCanvasElement;
        
        if (canvas && typeof window !== 'undefined' && (window as any).Chart) {
          const Chart = (window as any).Chart;
          
          // Destroy existing chart if it exists
          const existingChart = Chart.getChart(canvas);
          if (existingChart) {
            existingChart.destroy();
          }
          
          // Create new chart
          new Chart(canvas, result.chartConfig);
        }
      }
    });
  }, [questionResults]);

  const fetchSchemas = async (env: string) => {
    setLoading(true);
    setError("");
    setSelectedSchema("");
    
    try {
      const response = await fetch("/api/schemas", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ env }),
      });

      if (!response.ok) {
        throw new Error("Failed to fetch schemas");
      }

      const data = await response.json();
      setSchemas(data.schemas || []);
    } catch (err) {
      setError("Failed to load schemas");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchTables = async (env: string, schema: string) => {
    setLoadingTables(true);
    setTablesError("");
    setTablesWithColumns([]);
    setSchemaAnalysis("");
    
    try {
      const response = await fetch("/api/tables", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ env, schema }),
      });

      if (!response.ok) {
        throw new Error("Failed to fetch tables");
      }

      const data = await response.json();
      setTables(data.tables || []);
    } catch (err) {
      setTablesError("Failed to load tables");
      console.error(err);
    } finally {
      setLoadingTables(false);
    }
  };

  const fetchAllColumns = async (env: string, schema: string, tables: Table[]) => {
    setLoadingAllColumns(true);
    
    try {
      // Fetch columns for all tables in parallel
      const columnPromises = tables.map(async (table) => {
        const response = await fetch("/api/columns", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ env, schema, table: table.name }),
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch columns for ${table.name}`);
        }

        const data = await response.json();
        return {
          table: table.name,
          type: table.type,
          columns: data.columns || [],
        };
      });

      const results = await Promise.all(columnPromises);
      setTablesWithColumns(results);
    } catch (err) {
      console.error("Error fetching all columns:", err);
      setTablesError("Failed to load columns for all tables");
    } finally {
      setLoadingAllColumns(false);
    }
  };

  const analyzeSchema = async () => {
    if (tablesWithColumns.length === 0) return;

    setAnalyzingSchema(true);
    setAnalysisError("");
    
    try {
      const response = await fetch("/api/analyze-schema", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          env: selectedEnv,
          schema: selectedSchema,
          tablesWithColumns,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to analyze schema");
      }

      const data = await response.json();
      setSchemaAnalysis(data.analysis || "");
    } catch (err) {
      setAnalysisError("Failed to analyze schema");
      console.error(err);
    } finally {
      setAnalyzingSchema(false);
    }
  };

  const generateQuestions = async () => {
    if (tablesWithColumns.length === 0) return;

    setGeneratingQuestions(true);
    setQuestionsError("");
    
    try {
      const response = await fetch("/api/generate-questions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          env: selectedEnv,
          schema: selectedSchema,
          tablesWithColumns,
          schemaAnalysis,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to generate questions");
      }

      const data = await response.json();
      setGeneratedQuestions(data.questions || []);
      setQuestionResults(new Map()); // Reset results when generating new questions
    } catch (err) {
      setQuestionsError("Failed to generate questions");
      console.error(err);
    } finally {
      setGeneratingQuestions(false);
    }
  };

  const handleQuestionClick = async (questionIndex: number, question: string) => {
    // Check if already processing or already has results
    const existing = questionResults.get(questionIndex);
    if (existing?.isProcessing) return;

    // Initialize the result state
    const newResults = new Map(questionResults);
    newResults.set(questionIndex, {
      question,
      isProcessing: true,
      currentStep: 'generating-sql',
      stepStatuses: {
        sqlGeneration: 'processing',
        sqlExecution: 'pending',
        interpretation: 'pending',
        chartGeneration: 'pending',
      },
    });
    setQuestionResults(new Map(newResults));

    try {
      // Build comprehensive schema context for SQL generation
      const schemaContextForSQL = tablesWithColumns.map(t => ({
        table: t.table,
        columns: t.columns.map(c => ({
          name: c.name,
          type: c.type,
          nullable: c.nullable,
        }))
      }));

      // Step 1: Generate SQL
      const sqlResponse = await fetch("/api/generate-sql", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          env: selectedEnv,
          schema: selectedSchema,
          table: "", // No specific table, query across schema
          naturalLanguageQuery: question,
          columns: [],
          sampleData: null,
          conversationContext: [],
          schemaContext: schemaContextForSQL, // Pass full schema context
        }),
      });

      if (!sqlResponse.ok) {
        throw new Error("Failed to generate SQL");
      }

      const { sql } = await sqlResponse.json();
      
      // Update with SQL and mark SQL generation as complete
      const current = newResults.get(questionIndex)!;
      newResults.set(questionIndex, {
        ...current,
        sql,
        currentStep: 'executing-sql',
        stepStatuses: {
          ...current.stepStatuses!,
          sqlGeneration: 'complete',
          sqlExecution: 'processing',
        },
      });
      setQuestionResults(new Map(newResults));

      // Step 2: Execute SQL
      const executeResponse = await fetch("/api/execute-sql", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          env: selectedEnv,
          sql,
        }),
      });

      if (!executeResponse.ok) {
        throw new Error("Failed to execute SQL");
      }

      const executeData = await executeResponse.json();
      
      if (executeData.error) {
        throw new Error(executeData.error);
      }

      const result = executeData.result;
      
      // Update with result and mark SQL execution as complete
      const current2 = newResults.get(questionIndex)!;
      newResults.set(questionIndex, {
        ...current2,
        result,
        currentStep: 'interpreting',
        stepStatuses: {
          ...current2.stepStatuses!,
          sqlExecution: 'complete',
          interpretation: 'processing',
        },
      });
      setQuestionResults(new Map(newResults));

      // Step 3: Generate interpretation
      const interpretResponse = await fetch("/api/interpret-results", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          naturalLanguageQuery: question,
          sql,
          result,
          conversationContext: [],
        }),
      });

      if (interpretResponse.ok) {
        const { interpretation } = await interpretResponse.json();
        
        // Update with interpretation and mark interpretation as complete
        const current3 = newResults.get(questionIndex)!;
        newResults.set(questionIndex, {
          ...current3,
          interpretation,
          currentStep: 'generating-chart',
          stepStatuses: {
            ...current3.stepStatuses!,
            interpretation: 'complete',
            chartGeneration: 'processing',
          },
        });
        setQuestionResults(new Map(newResults));
      } else {
        // Mark interpretation as error but continue
        const current3 = newResults.get(questionIndex)!;
        newResults.set(questionIndex, {
          ...current3,
          currentStep: 'generating-chart',
          stepStatuses: {
            ...current3.stepStatuses!,
            interpretation: 'error',
            chartGeneration: 'processing',
          },
        });
        setQuestionResults(new Map(newResults));
      }

      // Step 4: Generate chart config
      const chartResponse = await fetch("/api/generate-chart-config", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          naturalLanguageQuery: question,
          sql,
          result,
          interpretation: newResults.get(questionIndex)?.interpretation,
        }),
      });

      if (chartResponse.ok) {
        const { chartConfig } = await chartResponse.json();
        
        // Update with chart config and mark as complete
        const current4 = newResults.get(questionIndex)!;
        newResults.set(questionIndex, {
          ...current4,
          chartConfig,
          isProcessing: false,
          currentStep: 'complete',
          stepStatuses: {
            ...current4.stepStatuses!,
            chartGeneration: 'complete',
          },
        });
        setQuestionResults(new Map(newResults));
      } else {
        // Even if chart generation fails, mark as not processing
        const current4 = newResults.get(questionIndex)!;
        newResults.set(questionIndex, {
          ...current4,
          isProcessing: false,
          currentStep: 'complete',
          stepStatuses: {
            ...current4.stepStatuses!,
            chartGeneration: 'error',
          },
        });
        setQuestionResults(new Map(newResults));
      }

    } catch (err: any) {
      console.error("Error processing question:", err);
      newResults.set(questionIndex, {
        question,
        error: err.message || "Failed to process question",
        isProcessing: false,
      });
      setQuestionResults(new Map(newResults));
    }
  };

  return (
    <>
      <Script 
        src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"
        strategy="beforeInteractive"
      />
      <div className="min-h-screen">
        <div className="p-6">
          <div className="max-w-7xl mx-auto">
            <h1 className="text-4xl mb-8">query generation</h1>
          
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

        {selectedEnv && (
          <div className="mt-8">
            <h2 className="text-2xl mb-4">Available Schemas</h2>
            
            {loading && (
              <p className="text-gray-600 dark:text-gray-400">Loading schemas...</p>
            )}
            
            {error && (
              <p className="text-red-600 dark:text-red-400">{error}</p>
            )}
            
            {!loading && !error && schemas.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {schemas.map((schema) => (
                  <button
                    key={schema}
                    onClick={() => setSelectedSchema(schema)}
                    className={`border rounded-lg p-4 hover:border-gray-400 dark:hover:border-gray-600 transition-colors text-left ${
                      selectedSchema === schema
                        ? "border-blue-500 dark:border-blue-400 bg-blue-50 dark:bg-blue-950"
                        : "border-gray-300 dark:border-gray-700"
                    }`}
                  >
                    <p className="text-sm font-mono">{schema}</p>
                  </button>
                ))}
              </div>
            )}
            
            {!loading && !error && schemas.length === 0 && (
              <p className="text-gray-600 dark:text-gray-400">No schemas found</p>
            )}
          </div>
        )}

        {selectedSchema && (
          <div className="mt-8">
            <h2 className="text-2xl mb-4">Schema Overview: {selectedSchema}</h2>
            
            {loadingTables && (
              <p className="text-gray-600 dark:text-gray-400">Loading tables...</p>
            )}
            
            {tablesError && (
              <p className="text-red-600 dark:text-red-400">{tablesError}</p>
            )}
            
            {loadingAllColumns && !loadingTables && (
              <p className="text-gray-600 dark:text-gray-400">Loading columns for all tables...</p>
            )}

            {!loadingTables && !loadingAllColumns && !tablesError && tablesWithColumns.length > 0 && (
              <div className="space-y-6">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Found {tablesWithColumns.length} table{tablesWithColumns.length !== 1 ? 's' : ''} with {tablesWithColumns.reduce((sum, t) => sum + t.columns.length, 0)} total columns
                  </p>
                  <div className="flex gap-3">
                    <button
                      onClick={analyzeSchema}
                      disabled={analyzingSchema}
                      className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                    >
                      {analyzingSchema && (
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      )}
                      {analyzingSchema ? 'Analyzing...' : 'Analyze Schema'}
                    </button>
                    <button
                      onClick={generateQuestions}
                      disabled={generatingQuestions}
                      className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                    >
                      {generatingQuestions && (
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      )}
                      {generatingQuestions ? 'Generating...' : 'Generate Questions'}
                    </button>
                  </div>
                </div>

                {/* Display all tables and their columns */}
                <div className="space-y-4">
                  {tablesWithColumns.map((tableWithCols) => (
                    <div key={tableWithCols.table} className="border border-gray-300 dark:border-gray-700 rounded-lg overflow-hidden">
                      <div className="bg-gray-50 dark:bg-gray-800 px-4 py-3 border-b border-gray-300 dark:border-gray-700">
                        <div className="flex items-center justify-between">
                          <h3 className="text-lg font-mono">{tableWithCols.table}</h3>
                          <span className="text-sm text-gray-600 dark:text-gray-400">{tableWithCols.type}</span>
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                          {tableWithCols.columns.length} column{tableWithCols.columns.length !== 1 ? 's' : ''}
                        </p>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead className="bg-gray-50 dark:bg-gray-900">
                            <tr>
                              <th className="px-4 py-2 text-left text-xs font-medium">Column Name</th>
                              <th className="px-4 py-2 text-left text-xs font-medium">Data Type</th>
                              <th className="px-4 py-2 text-left text-xs font-medium">Nullable</th>
                              <th className="px-4 py-2 text-left text-xs font-medium">Default</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                            {tableWithCols.columns.map((column) => (
                              <tr key={column.name} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                                <td className="px-4 py-2 text-sm font-mono">{column.name}</td>
                                <td className="px-4 py-2 text-sm">
                                  {column.type}
                                  {column.maxLength && <span className="text-gray-500"> ({column.maxLength})</span>}
                                </td>
                                <td className="px-4 py-2 text-sm">
                                  <span className={column.nullable ? "text-gray-600 dark:text-gray-400" : "text-red-600 dark:text-red-400"}>
                                    {column.nullable ? "YES" : "NO"}
                                  </span>
                                </td>
                                <td className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 font-mono">
                                  {column.default || "-"}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))}
                </div>

                {/* AI Analysis Section */}
                {(schemaAnalysis || analyzingSchema || analysisError) && (
                  <div className="mt-8">
                    <h2 className="text-2xl mb-4">AI Schema Analysis</h2>
                    
                    {analysisError && (
                      <div className="border border-red-300 dark:border-red-700 rounded-lg p-6 bg-red-50 dark:bg-red-950">
                        <p className="text-red-600 dark:text-red-400">{analysisError}</p>
                      </div>
                    )}
                    
                    {schemaAnalysis && !analyzingSchema && (
                      <div className="border border-gray-300 dark:border-gray-700 rounded-lg p-6 bg-white dark:bg-gray-900">
                        <div className="prose dark:prose-invert max-w-none">
                          <div className="whitespace-pre-wrap">{schemaAnalysis}</div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Generated Questions Section */}
                {(generatedQuestions.length > 0 || generatingQuestions || questionsError) && (
                  <div className="mt-8">
                    <h2 className="text-2xl mb-4">Generated Questions</h2>
                    
                    {questionsError && (
                      <div className="border border-red-300 dark:border-red-700 rounded-lg p-6 bg-red-50 dark:bg-red-950">
                        <p className="text-red-600 dark:text-red-400">{questionsError}</p>
                      </div>
                    )}
                    
                    {generatedQuestions.length > 0 && !generatingQuestions && (
                      <div className="space-y-3">
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                          Click on any question to generate SQL, execute it, and see results:
                        </p>
                        {generatedQuestions.map((question, idx) => {
                          const result = questionResults.get(idx);
                          return (
                            <div key={idx} className="border border-gray-300 dark:border-gray-700 rounded-lg overflow-hidden">
                              <button
                                onClick={() => handleQuestionClick(idx, question)}
                                disabled={result?.isProcessing}
                                className="w-full p-4 bg-white dark:bg-gray-900 hover:border-blue-500 dark:hover:border-blue-400 transition-colors text-left disabled:opacity-50"
                              >
                                <div className="flex items-start gap-3">
                                  <span className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 text-sm font-semibold">
                                    {idx + 1}
                                  </span>
                                  <div className="flex-1">
                                    <p className="text-sm">{question}</p>
                                  </div>
                                </div>
                              </button>

                              {result && (
                                <div className="border-t border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-950 p-4 space-y-4">
                                  {/* Progress Steps */}
                                  {result.stepStatuses && (
                                    <div className="space-y-2">
                                      {/* SQL Generation Step */}
                                      <div className="flex items-center gap-3">
                                        {result.stepStatuses.sqlGeneration === 'processing' && (
                                          <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                                        )}
                                        {result.stepStatuses.sqlGeneration === 'complete' && (
                                          <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                          </svg>
                                        )}
                                        {result.stepStatuses.sqlGeneration === 'error' && (
                                          <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                          </svg>
                                        )}
                                        {result.stepStatuses.sqlGeneration === 'pending' && (
                                          <div className="w-4 h-4 rounded-full border-2 border-gray-300 dark:border-gray-700"></div>
                                        )}
                                        <span className={`text-xs ${
                                          result.stepStatuses.sqlGeneration === 'processing' ? 'text-blue-600 dark:text-blue-400 font-semibold' :
                                          result.stepStatuses.sqlGeneration === 'complete' ? 'text-green-600 dark:text-green-400' :
                                          result.stepStatuses.sqlGeneration === 'error' ? 'text-red-600 dark:text-red-400' :
                                          'text-gray-500 dark:text-gray-500'
                                        }`}>
                                          {result.stepStatuses.sqlGeneration === 'processing' ? 'Generating SQL...' :
                                           result.stepStatuses.sqlGeneration === 'complete' ? 'SQL Generated' :
                                           result.stepStatuses.sqlGeneration === 'error' ? 'SQL Generation Failed' :
                                           'Generate SQL'}
                                        </span>
                                      </div>

                                      {/* SQL Execution Step */}
                                      <div className="flex items-center gap-3">
                                        {result.stepStatuses.sqlExecution === 'processing' && (
                                          <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                                        )}
                                        {result.stepStatuses.sqlExecution === 'complete' && (
                                          <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                          </svg>
                                        )}
                                        {result.stepStatuses.sqlExecution === 'error' && (
                                          <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                          </svg>
                                        )}
                                        {result.stepStatuses.sqlExecution === 'pending' && (
                                          <div className="w-4 h-4 rounded-full border-2 border-gray-300 dark:border-gray-700"></div>
                                        )}
                                        <span className={`text-xs ${
                                          result.stepStatuses.sqlExecution === 'processing' ? 'text-blue-600 dark:text-blue-400 font-semibold' :
                                          result.stepStatuses.sqlExecution === 'complete' ? 'text-green-600 dark:text-green-400' :
                                          result.stepStatuses.sqlExecution === 'error' ? 'text-red-600 dark:text-red-400' :
                                          'text-gray-500 dark:text-gray-500'
                                        }`}>
                                          {result.stepStatuses.sqlExecution === 'processing' ? 'Executing SQL...' :
                                           result.stepStatuses.sqlExecution === 'complete' ? 'SQL Executed' :
                                           result.stepStatuses.sqlExecution === 'error' ? 'SQL Execution Failed' :
                                           'Execute SQL'}
                                        </span>
                                      </div>

                                      {/* Interpretation Step */}
                                      <div className="flex items-center gap-3">
                                        {result.stepStatuses.interpretation === 'processing' && (
                                          <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                                        )}
                                        {result.stepStatuses.interpretation === 'complete' && (
                                          <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                          </svg>
                                        )}
                                        {result.stepStatuses.interpretation === 'error' && (
                                          <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                          </svg>
                                        )}
                                        {result.stepStatuses.interpretation === 'pending' && (
                                          <div className="w-4 h-4 rounded-full border-2 border-gray-300 dark:border-gray-700"></div>
                                        )}
                                        <span className={`text-xs ${
                                          result.stepStatuses.interpretation === 'processing' ? 'text-blue-600 dark:text-blue-400 font-semibold' :
                                          result.stepStatuses.interpretation === 'complete' ? 'text-green-600 dark:text-green-400' :
                                          result.stepStatuses.interpretation === 'error' ? 'text-red-600 dark:text-red-400' :
                                          'text-gray-500 dark:text-gray-500'
                                        }`}>
                                          {result.stepStatuses.interpretation === 'processing' ? 'Interpreting Results...' :
                                           result.stepStatuses.interpretation === 'complete' ? 'Results Interpreted' :
                                           result.stepStatuses.interpretation === 'error' ? 'Interpretation Failed' :
                                           'Interpret Results'}
                                        </span>
                                      </div>

                                      {/* Chart Generation Step */}
                                      <div className="flex items-center gap-3">
                                        {result.stepStatuses.chartGeneration === 'processing' && (
                                          <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                                        )}
                                        {result.stepStatuses.chartGeneration === 'complete' && (
                                          <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                          </svg>
                                        )}
                                        {result.stepStatuses.chartGeneration === 'error' && (
                                          <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                          </svg>
                                        )}
                                        {result.stepStatuses.chartGeneration === 'pending' && (
                                          <div className="w-4 h-4 rounded-full border-2 border-gray-300 dark:border-gray-700"></div>
                                        )}
                                        <span className={`text-xs ${
                                          result.stepStatuses.chartGeneration === 'processing' ? 'text-blue-600 dark:text-blue-400 font-semibold' :
                                          result.stepStatuses.chartGeneration === 'complete' ? 'text-green-600 dark:text-green-400' :
                                          result.stepStatuses.chartGeneration === 'error' ? 'text-red-600 dark:text-red-400' :
                                          'text-gray-500 dark:text-gray-500'
                                        }`}>
                                          {result.stepStatuses.chartGeneration === 'processing' ? 'Generating Visualization...' :
                                           result.stepStatuses.chartGeneration === 'complete' ? 'Visualization Generated' :
                                           result.stepStatuses.chartGeneration === 'error' ? 'Visualization Failed' :
                                           'Generate Visualization'}
                                        </span>
                                      </div>
                                    </div>
                                  )}

                                  {result.error && (
                                    <div className="text-red-600 dark:text-red-400 text-sm border-t border-gray-300 dark:border-gray-700 pt-4">
                                      <p className="font-semibold mb-1">Error:</p>
                                      <p>{result.error}</p>
                                    </div>
                                  )}
                                  
                                  {!result.error && !result.isProcessing && (
                                    <div className="border-t border-gray-300 dark:border-gray-700 pt-4 space-y-4">
                                      {result.sql && (
                                        <div>
                                          <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-2">Generated SQL:</p>
                                          <pre className="text-xs font-mono bg-gray-100 dark:bg-gray-900 p-3 rounded overflow-x-auto">
                                            {result.sql}
                                          </pre>
                                        </div>
                                      )}

                                      {result.result && (
                                        <div>
                                          <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-2">
                                            Query Results ({result.result.rowCount} rows):
                                          </p>
                                          <div className="border border-gray-300 dark:border-gray-700 rounded overflow-x-auto max-h-64">
                                            <table className="w-full text-xs">
                                              <thead className="bg-gray-100 dark:bg-gray-800 sticky top-0">
                                                <tr>
                                                  {result.result.columns.map((col) => (
                                                    <th key={col} className="px-3 py-2 text-left font-medium whitespace-nowrap">
                                                      {col}
                                                    </th>
                                                  ))}
                                                </tr>
                                              </thead>
                                              <tbody className="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-gray-900">
                                                {result.result.rows.slice(0, 10).map((row, rowIdx) => (
                                                  <tr key={rowIdx} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                                                    {result.result!.columns.map((col) => (
                                                      <td key={col} className="px-3 py-2 font-mono whitespace-nowrap">
                                                        {row[col] === null ? (
                                                          <span className="text-gray-400 italic">null</span>
                                                        ) : typeof row[col] === 'object' ? (
                                                          JSON.stringify(row[col])
                                                        ) : (
                                                          String(row[col])
                                                        )}
                                                      </td>
                                                    ))}
                                                  </tr>
                                                ))}
                                              </tbody>
                                            </table>
                                          </div>
                                          {result.result.rowCount > 10 && (
                                            <p className="text-xs text-gray-500 mt-1">Showing first 10 of {result.result.rowCount} rows</p>
                                          )}
                                        </div>
                                      )}

                                      {result.interpretation && (
                                        <div className="border-t border-gray-300 dark:border-gray-700 pt-3">
                                          <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-2">Interpretation:</p>
                                          <p className="text-sm leading-relaxed">{result.interpretation}</p>
                                        </div>
                                      )}

                                      {result.chartConfig && (
                                        <div className="border-t border-gray-300 dark:border-gray-700 pt-3">
                                          <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-3">Visualization:</p>
                                          <div className="bg-white dark:bg-gray-900 p-4 rounded border border-gray-300 dark:border-gray-700">
                                            <canvas id={`chart-${idx}`}></canvas>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
            
            {!loadingTables && !loadingAllColumns && !tablesError && tables.length === 0 && (
              <p className="text-gray-600 dark:text-gray-400">No tables found in this schema</p>
            )}
          </div>
        )}
          </div>
        </div>
      </div>
    </>
  );
}

