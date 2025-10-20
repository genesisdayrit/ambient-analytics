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

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sql?: string;
  result?: QueryResult;
  interpretation?: string;
  error?: string;
  timestamp: Date;
}

export default function NaturalLanguageToSQL() {
  const [selectedEnv, setSelectedEnv] = useState("");
  const [schemas, setSchemas] = useState<string[]>([]);
  const [selectedSchema, setSelectedSchema] = useState("");
  const [tables, setTables] = useState<Table[]>([]);
  const [selectedTable, setSelectedTable] = useState("");
  const [columns, setColumns] = useState<Column[]>([]);
  const [sampleData, setSampleData] = useState<SampleData | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentInput, setCurrentInput] = useState("");
  const [expandedResults, setExpandedResults] = useState<Set<string>>(new Set());
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
      setMessages([]);
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
      setMessages([]);
    }
  }, [selectedSchema, selectedEnv]);

  useEffect(() => {
    if (selectedTable && selectedSchema && selectedEnv) {
      fetchColumns(selectedEnv, selectedSchema, selectedTable);
      fetchSampleData(selectedEnv, selectedSchema, selectedTable);
    } else {
      setColumns([]);
      setSampleData(null);
      setMessages([]);
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

  const sendMessage = async () => {
    if (!currentInput.trim()) {
      return;
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: currentInput,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setCurrentInput("");

    // Create assistant message placeholder
    const assistantMessageId = (Date.now() + 1).toString();
    const assistantMessage: Message = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, assistantMessage]);

    // Build conversation context for the API
    const conversationContext = messages.map(msg => ({
      role: msg.role,
      content: msg.content,
      sql: msg.sql,
      result: msg.result ? {
        rowCount: msg.result.rowCount,
        preview: JSON.stringify(msg.result.rows.slice(0, 3))
      } : undefined
    }));
    
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
          naturalLanguageQuery: currentInput,
          columns,
          sampleData,
          conversationContext,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to generate SQL");
      }

      const data = await response.json();
      sql = data.sql || "";
      
      // Update assistant message with SQL
      setMessages(prev => prev.map(msg => 
        msg.id === assistantMessageId 
          ? { ...msg, sql } 
          : msg
      ));
    } catch (err) {
      setMessages(prev => prev.map(msg => 
        msg.id === assistantMessageId 
          ? { ...msg, error: "Failed to generate SQL" } 
          : msg
      ));
      console.error(err);
      setGeneratingSQL(false);
      return;
    }
    
    setGeneratingSQL(false);

    // Step 2: Execute SQL
    setExecutingSQL(true);
    let result: QueryResult | undefined = undefined;
    
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
        setMessages(prev => prev.map(msg => 
          msg.id === assistantMessageId 
            ? { ...msg, error: data.error } 
            : msg
        ));
        setExecutingSQL(false);
        return;
      }
      
      result = data.result;
      
      // Update assistant message with result
      setMessages(prev => prev.map(msg => 
        msg.id === assistantMessageId 
          ? { ...msg, result: result } 
          : msg
      ));
    } catch (err) {
      setMessages(prev => prev.map(msg => 
        msg.id === assistantMessageId 
          ? { ...msg, error: "Failed to execute SQL" } 
          : msg
      ));
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
            naturalLanguageQuery: currentInput,
            sql,
            result,
            conversationContext,
          }),
        });

        if (!response.ok) {
          throw new Error("Failed to generate interpretation");
        }

        const data = await response.json();
        
        // Update assistant message with interpretation
        setMessages(prev => prev.map(msg => 
          msg.id === assistantMessageId 
            ? { ...msg, interpretation: data.interpretation || "", content: data.interpretation || "" } 
            : msg
        ));
      } catch (err) {
        console.error("Failed to generate interpretation:", err);
      } finally {
        setGeneratingInterpretation(false);
      }
    }
  };

  return (
    <div className="min-h-screen">
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
            <h2 className="text-2xl mb-4">Chat with Table</h2>
            
            {/* Messages Display */}
            <div className="mb-6 space-y-4 max-h-[600px] overflow-y-auto border border-gray-300 dark:border-gray-700 rounded-lg p-4">
              {messages.length === 0 ? (
                <p className="text-gray-500 dark:text-gray-400 text-center py-8">
                  Start a conversation by asking a question about your data...
                </p>
              ) : (
                messages.map((message) => (
                  <div key={message.id} className={`${message.role === 'user' ? 'text-right' : 'text-left'}`}>
                    {message.role === 'user' ? (
                      <div className="inline-block bg-blue-600 text-white px-4 py-2 rounded-lg max-w-[80%]">
                        <p className="text-sm">{message.content}</p>
                      </div>
                    ) : (
                      <div className="inline-block bg-gray-100 dark:bg-gray-800 px-4 py-3 rounded-lg max-w-[90%] text-left">
                        {message.error ? (
                          <div className="text-red-600 dark:text-red-400">
                            <p className="text-sm font-semibold mb-1">Error</p>
                            <p className="text-sm">{message.error}</p>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {message.sql && (
                              <div>
                                <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">SQL Query:</p>
                                <pre className="text-xs font-mono bg-gray-50 dark:bg-gray-900 p-2 rounded overflow-x-auto">
                                  {message.sql}
                                </pre>
                              </div>
                            )}
                            
                            {message.result && (
                              <div>
                                <div className="flex items-center justify-between mb-1">
                                  <p className="text-xs font-semibold text-gray-600 dark:text-gray-400">
                                    Results ({message.result.rowCount} rows)
                                  </p>
                                  {message.result.rowCount > 5 && (
                                    <button
                                      onClick={() => {
                                        const newExpanded = new Set(expandedResults);
                                        if (expandedResults.has(message.id)) {
                                          newExpanded.delete(message.id);
                                        } else {
                                          newExpanded.add(message.id);
                                        }
                                        setExpandedResults(newExpanded);
                                      }}
                                      className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                                    >
                                      {expandedResults.has(message.id) ? 'Show less' : `Show all ${message.result.rowCount} rows`}
                                    </button>
                                  )}
                                </div>
                                <div className={`border border-gray-300 dark:border-gray-700 rounded overflow-x-auto ${
                                  expandedResults.has(message.id) ? 'max-h-96' : 'max-h-64'
                                }`}>
                                  <table className="w-full text-xs">
                                    <thead className="bg-gray-50 dark:bg-gray-800 sticky top-0">
                                      <tr>
                                        {message.result.columns.map((col) => (
                                          <th key={col} className="px-2 py-1 text-left font-medium whitespace-nowrap">
                                            {col}
                                          </th>
                                        ))}
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                                      {(expandedResults.has(message.id) 
                                        ? message.result.rows 
                                        : message.result.rows.slice(0, 5)
                                      ).map((row, idx) => (
                                        <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                                          {message.result!.columns.map((col) => (
                                            <td key={col} className="px-2 py-1 font-mono whitespace-nowrap">
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
                                {!expandedResults.has(message.id) && message.result.rowCount > 5 && (
                                  <p className="text-xs text-gray-500 mt-1">Showing first 5 of {message.result.rowCount} rows</p>
                                )}
                              </div>
                            )}
                            
                            {message.interpretation && (
                              <div className="border-t border-gray-300 dark:border-gray-700 pt-2">
                                <p className="text-sm leading-relaxed">{message.interpretation}</p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))
              )}
              
              {/* Loading indicators */}
              {generatingSQL && (
                <div className="text-left">
                  <div className="inline-block bg-gray-100 dark:bg-gray-800 px-4 py-3 rounded-lg">
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                      <span className="text-sm">Generating SQL...</span>
                    </div>
                  </div>
                </div>
              )}
              
              {executingSQL && !generatingSQL && (
                <div className="text-left">
                  <div className="inline-block bg-gray-100 dark:bg-gray-800 px-4 py-3 rounded-lg">
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                      <span className="text-sm">Executing query...</span>
                    </div>
                  </div>
                </div>
              )}
              
              {generatingInterpretation && !executingSQL && !generatingSQL && (
                <div className="text-left">
                  <div className="inline-block bg-gray-100 dark:bg-gray-800 px-4 py-3 rounded-lg">
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                      <span className="text-sm">Generating interpretation...</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
            
            {/* Input Area */}
            <div className="flex gap-2">
              <input
                type="text"
                value={currentInput}
                onChange={(e) => setCurrentInput(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
                placeholder="Ask a question about your data..."
                className="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-400"
                disabled={generatingSQL || executingSQL || generatingInterpretation}
              />
              <button
                onClick={sendMessage}
                disabled={!currentInput.trim() || generatingSQL || executingSQL || generatingInterpretation}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
              >
                Send
              </button>
            </div>
          </div>
        )}
        </div>
      </div>
    </div>
  );
}
