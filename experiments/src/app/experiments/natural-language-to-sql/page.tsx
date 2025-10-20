"use client";

import Link from "next/link";
import { useState, useEffect } from "react";

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

export default function NaturalLanguageToSQL() {
  const [selectedEnv, setSelectedEnv] = useState("");
  const [schemas, setSchemas] = useState<string[]>([]);
  const [selectedSchema, setSelectedSchema] = useState("");
  const [tables, setTables] = useState<Table[]>([]);
  const [selectedTable, setSelectedTable] = useState("");
  const [columns, setColumns] = useState<Column[]>([]);
  const [sampleData, setSampleData] = useState<SampleData | null>(null);
  const [naturalLanguageQuery, setNaturalLanguageQuery] = useState("");
  const [generatedSQL, setGeneratedSQL] = useState("");
  const [queryResult, setQueryResult] = useState<QueryResult | null>(null);
  const [interpretation, setInterpretation] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingTables, setLoadingTables] = useState(false);
  const [loadingColumns, setLoadingColumns] = useState(false);
  const [loadingSample, setLoadingSample] = useState(false);
  const [generatingSQL, setGeneratingSQL] = useState(false);
  const [executingSQL, setExecutingSQL] = useState(false);
  const [generatingInterpretation, setGeneratingInterpretation] = useState(false);
  const [error, setError] = useState("");
  const [tablesError, setTablesError] = useState("");
  const [columnsError, setColumnsError] = useState("");
  const [sampleError, setSampleError] = useState("");
  const [sqlError, setSqlError] = useState("");
  const [executionError, setExecutionError] = useState("");

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
      setGeneratedSQL("");
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
      setGeneratedSQL("");
    }
  }, [selectedSchema, selectedEnv]);

  useEffect(() => {
    if (selectedTable && selectedSchema && selectedEnv) {
      fetchColumns(selectedEnv, selectedSchema, selectedTable);
      fetchSampleData(selectedEnv, selectedSchema, selectedTable);
    } else {
      setColumns([]);
      setSampleData(null);
      setGeneratedSQL("");
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

  const generateSQL = async () => {
    if (!naturalLanguageQuery.trim()) {
      return;
    }

    // Reset states
    setSqlError("");
    setExecutionError("");
    setQueryResult(null);
    setInterpretation("");
    setGeneratedSQL("");
    
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
          naturalLanguageQuery,
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
      setSqlError("Failed to generate SQL");
      console.error(err);
      setGeneratingSQL(false);
      return;
    }
    
    setGeneratingSQL(false);

    // Step 2: Execute SQL
    setExecutingSQL(true);
    let result = null;
    
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
        setExecutionError(data.error);
        setExecutingSQL(false);
        return;
      }
      
      result = data.result;
      setQueryResult(result);
    } catch (err) {
      setExecutionError("Failed to execute SQL");
      console.error(err);
      setExecutingSQL(false);
      return;
    }
    
    setExecutingSQL(false);

    // Step 3: Generate interpretation
    if (result) {
      setGeneratingInterpretation(true);
      
      try {
        const response = await fetch("/api/interpret-results", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            naturalLanguageQuery,
            sql,
            result,
          }),
        });

        if (!response.ok) {
          throw new Error("Failed to generate interpretation");
        }

        const data = await response.json();
        setInterpretation(data.interpretation || "");
      } catch (err) {
        console.error("Failed to generate interpretation:", err);
        // Don't show error to user, interpretation is optional
      } finally {
        setGeneratingInterpretation(false);
      }
    }
  };

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
        <div className="max-w-7xl mx-auto">
          <h1 className="text-4xl mb-8">chat with table</h1>
          
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
            <h2 className="text-2xl mb-4">Natural Language Query</h2>
            
            <div className="mb-4">
              <textarea
                value={naturalLanguageQuery}
                onChange={(e) => setNaturalLanguageQuery(e.target.value)}
                placeholder="Enter your query in natural language... (e.g., 'Show me all users who signed up in the last 30 days')"
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-400 min-h-[100px]"
              />
            </div>
            
            <button
              onClick={generateSQL}
              disabled={!naturalLanguageQuery.trim() || generatingSQL || executingSQL || generatingInterpretation}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              {generatingSQL ? "Generating SQL..." : 
               executingSQL ? "Executing Query..." : 
               generatingInterpretation ? "Generating Interpretation..." : 
               "Generate SQL"}
            </button>

            {sqlError && (
              <p className="text-red-600 dark:text-red-400 mt-4">{sqlError}</p>
            )}

            {(generatingSQL || generatedSQL) && (
              <div className="mt-6">
                <h3 className="text-xl mb-2">Generated SQL</h3>
                {generatingSQL ? (
                  <div className="border border-gray-300 dark:border-gray-700 rounded-lg p-4 bg-gray-50 dark:bg-gray-900">
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                      <span className="text-sm text-gray-600 dark:text-gray-400">Generating SQL query...</span>
                    </div>
                  </div>
                ) : (
                  <div className="border border-gray-300 dark:border-gray-700 rounded-lg p-4 bg-gray-50 dark:bg-gray-900">
                    <pre className="text-sm font-mono whitespace-pre-wrap">{generatedSQL}</pre>
                  </div>
                )}
              </div>
            )}

            {(executingSQL || executionError || queryResult) && (
              <div className="mt-6">
                <h3 className="text-xl mb-2">Query Results</h3>
                {executingSQL ? (
                  <div className="border border-gray-300 dark:border-gray-700 rounded-lg p-4">
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                      <span className="text-sm text-gray-600 dark:text-gray-400">Executing query...</span>
                    </div>
                  </div>
                ) : executionError ? (
                  <div className="border border-red-300 dark:border-red-700 rounded-lg p-4 bg-red-50 dark:bg-red-950">
                    <p className="text-sm font-semibold text-red-600 dark:text-red-400 mb-2">Execution Error</p>
                    <pre className="text-sm font-mono whitespace-pre-wrap text-red-600 dark:text-red-400">{executionError}</pre>
                  </div>
                ) : queryResult && queryResult.rows.length > 0 ? (
                  <>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">{queryResult.rowCount} rows</p>
                    <div className="border border-gray-300 dark:border-gray-700 rounded-lg overflow-auto max-h-96">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50 dark:bg-gray-800 sticky top-0">
                          <tr>
                            {queryResult.columns.map((col) => (
                              <th key={col} className="px-3 py-2 text-left text-xs font-medium whitespace-nowrap">
                                {col}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                          {queryResult.rows.map((row, idx) => (
                            <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                              {queryResult.columns.map((col) => (
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
                  </>
                ) : queryResult && queryResult.rows.length === 0 ? (
                  <p className="text-gray-600 dark:text-gray-400">Query executed successfully but returned no rows.</p>
                ) : null}
              </div>
            )}

            {(generatingInterpretation || interpretation) && (
              <div className="mt-6">
                <h3 className="text-xl mb-2">LLM Interpretation</h3>
                {generatingInterpretation ? (
                  <div className="border border-blue-300 dark:border-blue-700 rounded-lg p-4 bg-blue-50 dark:bg-blue-950">
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                      <span className="text-sm text-gray-600 dark:text-gray-400">Generating interpretation...</span>
                    </div>
                  </div>
                ) : (
                  <div className="border border-blue-300 dark:border-blue-700 rounded-lg p-4 bg-blue-50 dark:bg-blue-950">
                    <p className="text-sm whitespace-pre-wrap leading-relaxed">{interpretation}</p>
                  </div>
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
