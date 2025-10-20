"use client";

import { useState, useEffect, useRef } from "react";
import { Chart, ChartConfiguration, registerables } from 'chart.js';

// Register Chart.js components
if (typeof window !== 'undefined') {
  Chart.register(...registerables);
}

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

interface SampleData {
  columns: string[];
  rows: Record<string, any>[];
}

interface QueryResult {
  columns: string[];
  rows: Record<string, any>[];
  rowCount: number;
}

export default function ChartJSGeneration() {
  const [selectedEnv, setSelectedEnv] = useState("");
  const [schemas, setSchemas] = useState<string[]>([]);
  const [selectedSchema, setSelectedSchema] = useState("");
  const [tables, setTables] = useState<Table[]>([]);
  const [selectedTable, setSelectedTable] = useState("");
  const [columns, setColumns] = useState<Column[]>([]);
  const [sampleData, setSampleData] = useState<SampleData | null>(null);
  const [query, setQuery] = useState("");
  const [generatedSQL, setGeneratedSQL] = useState("");
  const [queryResults, setQueryResults] = useState<QueryResult | null>(null);
  const [interpretation, setInterpretation] = useState("");
  const [chartConfig, setChartConfig] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [loadingTables, setLoadingTables] = useState(false);
  const [loadingColumns, setLoadingColumns] = useState(false);
  const [loadingSample, setLoadingSample] = useState(false);
  const [generatingSQL, setGeneratingSQL] = useState(false);
  const [executingSQL, setExecutingSQL] = useState(false);
  const [generatingInterpretation, setGeneratingInterpretation] = useState(false);
  const [generatingChart, setGeneratingChart] = useState(false);
  const [error, setError] = useState("");
  const [tablesError, setTablesError] = useState("");
  const [columnsError, setColumnsError] = useState("");
  const [sampleError, setSampleError] = useState("");

  useEffect(() => {
    if (selectedEnv) {
      fetchSchemas(selectedEnv);
    } else {
      setSchemas([]);
      setSelectedSchema("");
      setTables([]);
      setSelectedTable("");
      setColumns([]);
      setSampleData(null);
    }
  }, [selectedEnv]);

  useEffect(() => {
    if (selectedSchema && selectedEnv) {
      fetchTables(selectedEnv, selectedSchema);
    } else {
      setTables([]);
      setSelectedTable("");
      setColumns([]);
      setSampleData(null);
    }
  }, [selectedSchema, selectedEnv]);

  useEffect(() => {
    if (selectedTable && selectedSchema && selectedEnv) {
      fetchColumns(selectedEnv, selectedSchema, selectedTable);
      fetchSampleData(selectedEnv, selectedSchema, selectedTable);
    } else {
      setColumns([]);
      setSampleData(null);
    }
  }, [selectedTable, selectedSchema, selectedEnv]);

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
    setSelectedTable("");
    
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

  const fetchColumns = async (env: string, schema: string, table: string) => {
    setLoadingColumns(true);
    setColumnsError("");
    
    try {
      const response = await fetch("/api/columns", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ env, schema, table }),
      });

      if (!response.ok) {
        throw new Error("Failed to fetch columns");
      }

      const data = await response.json();
      setColumns(data.columns || []);
    } catch (err) {
      setColumnsError("Failed to load columns");
      console.error(err);
    } finally {
      setLoadingColumns(false);
    }
  };

  const fetchSampleData = async (env: string, schema: string, table: string) => {
    setLoadingSample(true);
    setSampleError("");
    
    try {
      const response = await fetch("/api/sample-data", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ env, schema, table }),
      });

      if (!response.ok) {
        throw new Error("Failed to fetch sample data");
      }

      const data = await response.json();
      setSampleData(data);
    } catch (err) {
      setSampleError("Failed to load sample data");
      console.error(err);
    } finally {
      setLoadingSample(false);
    }
  };

  const generateChart = async () => {
    if (!query.trim()) {
      return;
    }

    // Reset previous results
    setGeneratedSQL("");
    setQueryResults(null);
    setInterpretation("");
    setChartConfig(null);
    setError("");

    // Step 1: Generate SQL
    setGeneratingSQL(true);
    let sql = "";
    
    try {
      const response = await fetch("/api/generate-sql", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          env: selectedEnv,
          schema: selectedSchema,
          table: selectedTable,
          naturalLanguageQuery: query,
          columns,
          sampleData,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to generate SQL");
      }

      const data = await response.json();
      sql = data.sql || "";
      setGeneratedSQL(sql);
    } catch (err) {
      setError("Failed to generate SQL");
      console.error(err);
      setGeneratingSQL(false);
      return;
    }
    
    setGeneratingSQL(false);

    // Step 2: Execute SQL
    setExecutingSQL(true);
    let result: QueryResult | null = null;
    
    try {
      const response = await fetch("/api/execute-sql", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          env: selectedEnv,
          sql,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to execute SQL");
      }

      const data = await response.json();
      
      if (data.error) {
        setError(data.error);
        setExecutingSQL(false);
        return;
      }
      
      result = data.result;
      setQueryResults(result);
    } catch (err) {
      setError("Failed to execute SQL");
      console.error(err);
      setExecutingSQL(false);
      return;
    }
    
    setExecutingSQL(false);

    if (!result) return;

    // Step 3: Generate interpretation
    setGeneratingInterpretation(true);
    let interpretationText = "";
    
    try {
      const response = await fetch("/api/interpret-results", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          naturalLanguageQuery: query,
          sql,
          result,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to generate interpretation");
      }

      const data = await response.json();
      interpretationText = data.interpretation || "";
      setInterpretation(interpretationText);
    } catch (err) {
      console.error("Failed to generate interpretation:", err);
    }
    
    setGeneratingInterpretation(false);

    // Step 4: Generate chart config
    setGeneratingChart(true);
    
    try {
      const response = await fetch("/api/generate-chart-config", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          naturalLanguageQuery: query,
          sql,
          result,
          interpretation: interpretationText,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to generate chart config");
      }

      const data = await response.json();
      setChartConfig(data.chartConfig);
    } catch (err) {
      console.error("Failed to generate chart:", err);
      setError("Failed to generate chart visualization");
    } finally {
      setGeneratingChart(false);
    }
  };

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
            <h2 className="text-2xl mb-4">Tables in {selectedSchema}</h2>
            
            {loadingTables && (
              <p className="text-gray-600 dark:text-gray-400">Loading tables...</p>
            )}
            
            {tablesError && (
              <p className="text-red-600 dark:text-red-400">{tablesError}</p>
            )}
            
            {!loadingTables && !tablesError && tables.length > 0 && (
              <div className="border border-gray-300 dark:border-gray-700 rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-50 dark:bg-gray-800">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-medium">Table Name</th>
                      <th className="px-4 py-3 text-left text-sm font-medium">Type</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {tables.map((table) => (
                      <tr 
                        key={table.name} 
                        onClick={() => setSelectedTable(table.name)}
                        className={`cursor-pointer transition-colors ${
                          selectedTable === table.name
                            ? "bg-blue-50 dark:bg-blue-950"
                            : "hover:bg-gray-50 dark:hover:bg-gray-800"
                        }`}
                      >
                        <td className="px-4 py-3 text-sm font-mono">{table.name}</td>
                        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{table.type}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            
            {!loadingTables && !tablesError && tables.length === 0 && (
              <p className="text-gray-600 dark:text-gray-400">No tables found in this schema</p>
            )}
          </div>
        )}

        {selectedTable && (
          <div className="mt-8">
            <h2 className="text-2xl mb-4">Table Schema & Sample Data</h2>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Column Information Schema */}
              <div>
                <h3 className="text-lg mb-3">Columns in {selectedTable}</h3>
                
                {loadingColumns && (
                  <p className="text-gray-600 dark:text-gray-400">Loading columns...</p>
                )}
                
                {columnsError && (
                  <p className="text-red-600 dark:text-red-400">{columnsError}</p>
                )}
                
                {!loadingColumns && !columnsError && columns.length > 0 && (
                  <div className="border border-gray-300 dark:border-gray-700 rounded-lg overflow-hidden">
                    <table className="w-full">
                      <thead className="bg-gray-50 dark:bg-gray-800">
                        <tr>
                          <th className="px-4 py-3 text-left text-sm font-medium">Column Name</th>
                          <th className="px-4 py-3 text-left text-sm font-medium">Data Type</th>
                          <th className="px-4 py-3 text-left text-sm font-medium">Nullable</th>
                          <th className="px-4 py-3 text-left text-sm font-medium">Default</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                        {columns.map((column) => (
                          <tr key={column.name} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                            <td className="px-4 py-3 text-sm font-mono">{column.name}</td>
                            <td className="px-4 py-3 text-sm">
                              {column.type}
                              {column.maxLength && <span className="text-gray-500">({column.maxLength})</span>}
                            </td>
                            <td className="px-4 py-3 text-sm">
                              <span className={column.nullable ? "text-gray-600 dark:text-gray-400" : "text-red-600 dark:text-red-400"}>
                                {column.nullable ? "YES" : "NO"}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400 font-mono">
                              {column.default || "-"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                
                {!loadingColumns && !columnsError && columns.length === 0 && (
                  <p className="text-gray-600 dark:text-gray-400">No columns found in this table</p>
                )}
              </div>

              {/* Sample Data */}
              <div>
                <h3 className="text-lg mb-3">Sample Data (LIMIT 10)</h3>
                
                {loadingSample && (
                  <p className="text-gray-600 dark:text-gray-400">Loading sample data...</p>
                )}
                
                {sampleError && (
                  <p className="text-red-600 dark:text-red-400">{sampleError}</p>
                )}
                
                {!loadingSample && !sampleError && sampleData && sampleData.rows.length > 0 && (
                  <div className="border border-gray-300 dark:border-gray-700 rounded-lg overflow-auto max-h-[600px]">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 dark:bg-gray-800 sticky top-0">
                        <tr>
                          {sampleData.columns.map((col) => (
                            <th key={col} className="px-3 py-2 text-left text-xs font-medium whitespace-nowrap">
                              {col}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                        {sampleData.rows.map((row, idx) => (
                          <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                            {sampleData.columns.map((col) => (
                              <td key={col} className="px-3 py-2 text-xs font-mono whitespace-nowrap">
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
                )}
                
                {!loadingSample && !sampleError && sampleData && sampleData.rows.length === 0 && (
                  <p className="text-gray-600 dark:text-gray-400">No data found in this table</p>
                )}
              </div>
            </div>
          </div>
        )}

        {selectedTable && (
          <div className="mt-8">
            <h2 className="text-2xl mb-4">Generate Chart</h2>
            
            <div className="mb-6">
              <label htmlFor="query-input" className="block text-sm mb-2">
                Describe the chart you want to create
              </label>
              <div className="flex gap-2">
                <input
                  id="query-input"
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      generateChart();
                    }
                  }}
                  placeholder="e.g., Show me a bar chart of sales by month"
                  className="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-400"
                  disabled={generatingSQL || executingSQL || generatingInterpretation || generatingChart}
                />
                <button
                  onClick={generateChart}
                  disabled={!query.trim() || generatingSQL || executingSQL || generatingInterpretation || generatingChart}
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                >
                  Generate
                </button>
              </div>
            </div>

            {/* Error Display */}
            {error && (
              <div className="mb-6 p-4 bg-red-50 dark:bg-red-950 border border-red-300 dark:border-red-700 rounded-lg">
                <p className="text-red-600 dark:text-red-400">{error}</p>
              </div>
            )}

            {/* SQL Display */}
            {(generatingSQL || generatedSQL) && (
              <div className="mb-6">
                <h3 className="text-lg font-semibold mb-2">Generated SQL</h3>
                {generatingSQL ? (
                  <div className="flex items-center gap-2 p-4 border border-gray-300 dark:border-gray-700 rounded-lg">
                    <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                    <span className="text-sm">Generating SQL...</span>
                  </div>
                ) : (
                  <pre className="p-4 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg overflow-x-auto text-sm font-mono">
                    {generatedSQL}
                  </pre>
                )}
              </div>
            )}

            {/* Query Results Display */}
            {(executingSQL || queryResults) && (
              <div className="mb-6">
                <h3 className="text-lg font-semibold mb-2">Query Results</h3>
                {executingSQL ? (
                  <div className="flex items-center gap-2 p-4 border border-gray-300 dark:border-gray-700 rounded-lg">
                    <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                    <span className="text-sm">Executing query...</span>
                  </div>
                ) : queryResults && (
                  <div className="border border-gray-300 dark:border-gray-700 rounded-lg overflow-hidden">
                    <div className="p-2 bg-gray-50 dark:bg-gray-800">
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {queryResults.rowCount} row{queryResults.rowCount !== 1 ? 's' : ''} returned
                      </p>
                    </div>
                    <div className="overflow-x-auto max-h-64">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50 dark:bg-gray-800 sticky top-0">
                          <tr>
                            {queryResults.columns.map((col) => (
                              <th key={col} className="px-3 py-2 text-left text-xs font-medium whitespace-nowrap">
                                {col}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                          {queryResults.rows.slice(0, 10).map((row, idx) => (
                            <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                              {queryResults.columns.map((col) => (
                                <td key={col} className="px-3 py-2 text-xs font-mono whitespace-nowrap">
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
                    {queryResults.rowCount > 10 && (
                      <div className="p-2 bg-gray-50 dark:bg-gray-800 text-xs text-gray-500">
                        Showing first 10 of {queryResults.rowCount} rows
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Interpretation Display */}
            {(generatingInterpretation || interpretation) && (
              <div className="mb-6">
                <h3 className="text-lg font-semibold mb-2">Interpretation</h3>
                {generatingInterpretation ? (
                  <div className="flex items-center gap-2 p-4 border border-gray-300 dark:border-gray-700 rounded-lg">
                    <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                    <span className="text-sm">Generating interpretation...</span>
                  </div>
                ) : (
                  <div className="p-4 border border-gray-300 dark:border-gray-700 rounded-lg">
                    <p className="text-sm leading-relaxed">{interpretation}</p>
                  </div>
                )}
              </div>
            )}

            {/* Chart Display */}
            {(generatingChart || chartConfig) && (
              <div className="mb-6">
                <h3 className="text-lg font-semibold mb-2">Visualization</h3>
                {generatingChart ? (
                  <div className="flex items-center gap-2 p-4 border border-gray-300 dark:border-gray-700 rounded-lg">
                    <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                    <span className="text-sm">Generating chart...</span>
                  </div>
                ) : chartConfig && (
                  <ChartDisplay config={chartConfig} />
                )}
              </div>
            )}
          </div>
        )}
        </div>
      </div>
    </div>
  );
}

// Chart Display Component
function ChartDisplay({ config }: { config: ChartConfiguration }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart | null>(null);

  useEffect(() => {
    if (!canvasRef.current || !config) return;

    // Destroy previous chart instance
    if (chartRef.current) {
      chartRef.current.destroy();
    }

    // Create new chart
    try {
      chartRef.current = new Chart(canvasRef.current, config);
    } catch (error) {
      console.error("Failed to create chart:", error);
    }

    // Cleanup on unmount
    return () => {
      if (chartRef.current) {
        chartRef.current.destroy();
      }
    };
  }, [config]);

  return (
    <div className="border border-gray-300 dark:border-gray-700 rounded-lg p-6 bg-white dark:bg-gray-900">
      <div className="w-full max-w-4xl mx-auto">
        <canvas ref={canvasRef} />
      </div>
    </div>
  );
}

