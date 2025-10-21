"use client";

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

interface TableWithColumns {
  table: string;
  columns: Column[];
}

interface QueryResult {
  columns: string[];
  rows: Record<string, any>[];
  rowCount: number;
}

interface SQLEvaluation {
  score: number;
  summary: string;
  strengths: string[];
  issues: string[];
  suggestions: string;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  relevantTables?: string[];
  sql?: string;
  refinedSQL?: string;
  refinedEvaluation?: SQLEvaluation;
  refinedResult?: QueryResult;
  evaluation?: SQLEvaluation;
  result?: QueryResult;
  interpretation?: string;
  error?: string;
  timestamp: Date;
  userQuestion?: string; // Store the original question for refinement
  tablesWithColumns?: TableWithColumns[]; // Store schema context for refinement
}

export default function JoinTables() {
  const [selectedEnv, setSelectedEnv] = useState("");
  const [schemas, setSchemas] = useState<string[]>([]);
  const [selectedSchema, setSelectedSchema] = useState("");
  const [tables, setTables] = useState<Table[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentInput, setCurrentInput] = useState("");
  const [expandedResults, setExpandedResults] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [loadingTables, setLoadingTables] = useState(false);
  const [error, setError] = useState("");
  const [tablesError, setTablesError] = useState("");
  const [identifyingTables, setIdentifyingTables] = useState(false);
  const [fetchingColumns, setFetchingColumns] = useState(false);
  const [generatingSQL, setGeneratingSQL] = useState(false);
  const [executingSQL, setExecutingSQL] = useState(false);
  const [evaluating, setEvaluating] = useState(false);
  const [generatingInterpretation, setGeneratingInterpretation] = useState(false);
  const [refiningSQL, setRefiningSQL] = useState<string | null>(null); // messageId being refined

  useEffect(() => {
    if (selectedEnv) {
      fetchSchemas(selectedEnv);
    } else {
      setSchemas([]);
      setSelectedSchema("");
      setTables([]);
      setMessages([]);
    }
  }, [selectedEnv]);

  useEffect(() => {
    if (selectedSchema && selectedEnv) {
      fetchTables(selectedEnv, selectedSchema);
    } else {
      setTables([]);
      setMessages([]);
    }
  }, [selectedSchema, selectedEnv]);

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

  const sendMessage = async () => {
    if (!currentInput.trim()) {
      return;
    }

    const userQuestion = currentInput; // Store for later use
    
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: userQuestion,
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
      userQuestion, // Store the question for refinement
    };
    setMessages(prev => [...prev, assistantMessage]);

    // Build conversation context for the API
    const conversationContext = messages.map(msg => ({
      role: msg.role,
      content: msg.content,
      relevantTables: msg.relevantTables,
      sql: msg.sql,
      result: msg.result ? {
        rowCount: msg.result.rowCount,
        preview: JSON.stringify(msg.result.rows.slice(0, 3))
      } : undefined
    }));

    // Step 1: Identify relevant tables
    setIdentifyingTables(true);
    let relevantTables: string[] = [];
    
    try {
      const response = await fetch("/api/identify-relevant-tables", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: userQuestion,
          tables: tables.map(t => t.name),
          conversationContext,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to identify relevant tables");
      }

      const data = await response.json();
      relevantTables = data.relevantTables || [];
      
      // Update assistant message with relevant tables
      setMessages(prev => prev.map(msg => 
        msg.id === assistantMessageId 
          ? { ...msg, relevantTables } 
          : msg
      ));
    } catch (err) {
      setMessages(prev => prev.map(msg => 
        msg.id === assistantMessageId 
          ? { ...msg, error: "Failed to identify relevant tables" } 
          : msg
      ));
      console.error(err);
      setIdentifyingTables(false);
      return;
    }
    
    setIdentifyingTables(false);

    if (relevantTables.length === 0) {
      setMessages(prev => prev.map(msg => 
        msg.id === assistantMessageId 
          ? { ...msg, error: "No relevant tables identified for your query" } 
          : msg
      ));
      return;
    }

    // Step 2: Fetch columns for relevant tables
    setFetchingColumns(true);
    let tablesWithColumns: TableWithColumns[] = [];
    
    try {
      const columnPromises = relevantTables.map(async (tableName) => {
        const response = await fetch("/api/columns", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ 
            env: selectedEnv, 
            schema: selectedSchema, 
            table: tableName 
          }),
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch columns for ${tableName}`);
        }

        const data = await response.json();
        return {
          table: tableName,
          columns: data.columns || [],
        };
      });

      tablesWithColumns = await Promise.all(columnPromises);
      
      // Store tablesWithColumns in the message for refinement
      setMessages(prev => prev.map(msg => 
        msg.id === assistantMessageId 
          ? { ...msg, tablesWithColumns } 
          : msg
      ));
    } catch (err) {
      setMessages(prev => prev.map(msg => 
        msg.id === assistantMessageId 
          ? { ...msg, error: "Failed to fetch columns for relevant tables" } 
          : msg
      ));
      console.error(err);
      setFetchingColumns(false);
      return;
    }
    
    setFetchingColumns(false);

    // Step 3: Generate joined SQL query
    setGeneratingSQL(true);
    let sql = "";
    
    try {
      const response = await fetch("/api/generate-joined-sql", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          env: selectedEnv,
          schema: selectedSchema,
          query: userQuestion,
          tablesWithColumns,
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

    // Step 4: Execute SQL
    setExecutingSQL(true);
    let result: QueryResult | undefined = undefined;
    let executionError: string | null = null;
    
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
        executionError = data.error;
        setMessages(prev => prev.map(msg => 
          msg.id === assistantMessageId 
            ? { ...msg, error: data.error } 
            : msg
        ));
      } else {
        result = data.result;
        
        // Update assistant message with result
        setMessages(prev => prev.map(msg => 
          msg.id === assistantMessageId 
            ? { ...msg, result: result } 
            : msg
        ));
      }
    } catch (err) {
      executionError = "Failed to execute SQL";
      setMessages(prev => prev.map(msg => 
        msg.id === assistantMessageId 
          ? { ...msg, error: executionError! } 
          : msg
      ));
      console.error(err);
    }
    
    setExecutingSQL(false);

    // Step 5: Evaluate SQL Quality
    setEvaluating(true);
    let evaluation: SQLEvaluation | undefined = undefined;
    
    try {
      const response = await fetch("/api/evaluate-sql-query", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          question: userQuestion,
          generatedSQL: sql,
          schema: selectedSchema,
          tables: tablesWithColumns.map(twc => ({ name: twc.table, columns: twc.columns })),
          executionSuccess: !executionError,
          executionError,
          executionResult: result,
        }),
      });

      if (!response.ok) throw new Error("Failed to evaluate SQL");

      const data = await response.json();
      evaluation = data.evaluation;
      
      setMessages(prev => prev.map(msg => 
        msg.id === assistantMessageId 
          ? { ...msg, evaluation } 
          : msg
      ));
    } catch (err) {
      console.error("Evaluation error:", err);
    }
    
    setEvaluating(false);

    // Step 6: Generate interpretation
    if (result) {
      setGeneratingInterpretation(true);
      
      try {
        const response = await fetch("/api/interpret-results", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            naturalLanguageQuery: userQuestion,
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

  const refineSQL = async (messageId: string) => {
    const message = messages.find(m => m.id === messageId);
    if (!message || !message.sql || !message.evaluation || !message.userQuestion || !message.tablesWithColumns) {
      console.error("Cannot refine: missing required data");
      return;
    }

    setRefiningSQL(messageId);

    try {
      // Call the refinement API
      const response = await fetch("/api/refine-sql", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: message.userQuestion,
          originalSQL: message.sql,
          evaluation: message.evaluation,
          executionResult: message.result,
          schema: selectedSchema,
          schemaContext: message.tablesWithColumns,
        }),
      });

      if (!response.ok) throw new Error("Failed to refine SQL");

      const data = await response.json();
      const refinedSQL = data.refinedSQL;

      // Update message with refined SQL
      setMessages(prev => prev.map(msg => 
        msg.id === messageId ? { ...msg, refinedSQL } : msg
      ));

      // Execute the refined SQL
      try {
        const execResponse = await fetch("/api/execute-sql", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ env: selectedEnv, sql: refinedSQL }),
        });

        if (!execResponse.ok) throw new Error("Failed to execute refined SQL");

        const execData = await execResponse.json();
        
        if (execData.error) {
          setMessages(prev => prev.map(msg => 
            msg.id === messageId ? { ...msg, refinedResult: { columns: [], rows: [], rowCount: 0 } } : msg
          ));
        } else {
          setMessages(prev => prev.map(msg => 
            msg.id === messageId ? { ...msg, refinedResult: execData.result } : msg
          ));

          // Evaluate the refined SQL
          const evalResponse = await fetch("/api/evaluate-sql-query", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              question: message.userQuestion,
              generatedSQL: refinedSQL,
              schema: selectedSchema,
              tables: message.tablesWithColumns.map(twc => ({ name: twc.table, columns: twc.columns })),
              executionSuccess: true,
              executionResult: execData.result,
            }),
          });

          if (evalResponse.ok) {
            const evalData = await evalResponse.json();
            setMessages(prev => prev.map(msg => 
              msg.id === messageId ? { ...msg, refinedEvaluation: evalData.evaluation } : msg
            ));
          }
        }
      } catch (err) {
        console.error("Error executing refined SQL:", err);
      }
    } catch (err) {
      console.error("Error refining SQL:", err);
    } finally {
      setRefiningSQL(null);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 0.9) return "text-green-600 dark:text-green-400";
    if (score >= 0.7) return "text-blue-600 dark:text-blue-400";
    if (score >= 0.4) return "text-yellow-600 dark:text-yellow-400";
    return "text-red-600 dark:text-red-400";
  };

  return (
    <div className="min-h-screen">
      <div className="p-6">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-4xl mb-8">join tables</h1>
          
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
                <div className="border border-gray-300 dark:border-gray-700 rounded-lg overflow-hidden mb-8">
                  <div className="bg-gray-50 dark:bg-gray-800 px-4 py-3">
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {tables.length} tables available in this schema
                    </p>
                  </div>
                  <div className="max-h-40 overflow-y-auto">
                    <div className="px-4 py-2 flex flex-wrap gap-2">
                      {tables.map((table) => (
                        <span 
                          key={table.name}
                          className="inline-block px-3 py-1 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded text-xs font-mono"
                        >
                          {table.name}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )}
              
              {!loadingTables && !tablesError && tables.length === 0 && (
                <p className="text-gray-600 dark:text-gray-400">No tables found in this schema</p>
              )}
            </div>
          )}

          {selectedSchema && tables.length > 0 && (
            <div className="mt-8">
              <h2 className="text-2xl mb-4">Ask a Question</h2>
              
              {/* Messages Display */}
              <div className="mb-6 space-y-4 max-h-[600px] overflow-y-auto border border-gray-300 dark:border-gray-700 rounded-lg p-4">
                {messages.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-gray-500 dark:text-gray-400 mb-2">
                      Ask a question that requires joining multiple tables...
                    </p>
                    <p className="text-sm text-gray-400 dark:text-gray-500">
                      Example: "Show me all customers and their orders" or "What products have been ordered the most?"
                    </p>
                  </div>
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
                              {message.relevantTables && message.relevantTables.length > 0 && (
                                <div>
                                  <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">
                                    Relevant Tables Identified:
                                  </p>
                                  <div className="flex flex-wrap gap-1">
                                    {message.relevantTables.map((table) => (
                                      <span 
                                        key={table}
                                        className="inline-block px-2 py-0.5 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded text-xs font-mono"
                                      >
                                        {table}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}
                              
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
                              
                              {message.evaluation && (
                                <div className="border-t border-gray-300 dark:border-gray-700 pt-2">
                                  <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                      <p className="text-xs font-semibold text-gray-600 dark:text-gray-400">
                                        SQL Quality:
                                      </p>
                                      <span className={`text-sm font-bold ${getScoreColor(message.evaluation.score)}`}>
                                        {(message.evaluation.score * 100).toFixed(0)}%
                                      </span>
                                    </div>
                                    {message.evaluation.score < 0.9 && message.userQuestion && message.sql && !message.refinedSQL && (
                                      <button
                                        onClick={() => refineSQL(message.id)}
                                        disabled={refiningSQL === message.id}
                                        className="px-3 py-1 text-xs bg-purple-600 text-white rounded hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                                      >
                                        {refiningSQL === message.id ? 'Refining...' : '🔧 Refine SQL'}
                                      </button>
                                    )}
                                  </div>
                                  <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">{message.evaluation.summary}</p>
                                  {message.evaluation.strengths.length > 0 && (
                                    <div className="mb-2">
                                      <p className="text-xs font-semibold text-green-600 dark:text-green-400">Strengths:</p>
                                      <ul className="text-xs text-gray-600 dark:text-gray-400 list-disc list-inside">
                                        {message.evaluation.strengths.map((s, i) => <li key={i}>{s}</li>)}
                                      </ul>
                                    </div>
                                  )}
                                  {message.evaluation.issues.length > 0 && (
                                    <div className="mb-2">
                                      <p className="text-xs font-semibold text-orange-600 dark:text-orange-400">Issues:</p>
                                      <ul className="text-xs text-gray-600 dark:text-gray-400 list-disc list-inside">
                                        {message.evaluation.issues.map((i, idx) => <li key={idx}>{i}</li>)}
                                      </ul>
                                    </div>
                                  )}
                                  {message.evaluation.suggestions && (
                                    <div>
                                      <p className="text-xs font-semibold text-blue-600 dark:text-blue-400">Suggestions:</p>
                                      <p className="text-xs text-gray-600 dark:text-gray-400">{message.evaluation.suggestions}</p>
                                    </div>
                                  )}
                                </div>
                              )}

                              {message.refinedSQL && (
                                <div className="border-t border-gray-300 dark:border-gray-700 pt-3 mt-3">
                                  <div className="bg-purple-50 dark:bg-purple-950 border border-purple-200 dark:border-purple-800 rounded-lg p-3">
                                    <p className="text-xs font-semibold text-purple-700 dark:text-purple-300 mb-2">
                                      🔧 Refined SQL
                                    </p>
                                    <pre className="text-xs font-mono bg-white dark:bg-gray-900 p-2 rounded overflow-x-auto mb-2">
                                      {message.refinedSQL}
                                    </pre>
                                    
                                    {message.refinedEvaluation && (
                                      <div className="mb-2">
                                        <div className="flex items-center gap-2 mb-1">
                                          <p className="text-xs font-semibold text-gray-600 dark:text-gray-400">
                                            Refined Quality:
                                          </p>
                                          <span className={`text-sm font-bold ${getScoreColor(message.refinedEvaluation.score)}`}>
                                            {(message.refinedEvaluation.score * 100).toFixed(0)}%
                                          </span>
                                          {message.evaluation && message.refinedEvaluation.score > message.evaluation.score && (
                                            <span className="text-xs text-green-600 dark:text-green-400">
                                              ↑ +{((message.refinedEvaluation.score - message.evaluation.score) * 100).toFixed(0)}%
                                            </span>
                                          )}
                                        </div>
                                        <p className="text-xs text-gray-600 dark:text-gray-400">{message.refinedEvaluation.summary}</p>
                                      </div>
                                    )}

                                    {message.refinedResult && message.refinedResult.rowCount > 0 && (
                                      <div>
                                        <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">
                                          Refined Results ({message.refinedResult.rowCount} rows)
                                        </p>
                                        <div className="border border-gray-300 dark:border-gray-700 rounded overflow-x-auto max-h-48">
                                          <table className="w-full text-xs">
                                            <thead className="bg-gray-50 dark:bg-gray-800 sticky top-0">
                                              <tr>
                                                {message.refinedResult.columns.map((col) => (
                                                  <th key={col} className="px-2 py-1 text-left font-medium whitespace-nowrap">
                                                    {col}
                                                  </th>
                                                ))}
                                              </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                                              {message.refinedResult.rows.slice(0, 5).map((row, idx) => (
                                                <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                                                  {message.refinedResult!.columns.map((col) => (
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
                                      </div>
                                    )}
                                  </div>
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
                {identifyingTables && (
                  <div className="text-left">
                    <div className="inline-block bg-gray-100 dark:bg-gray-800 px-4 py-3 rounded-lg">
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                        <span className="text-sm">Identifying relevant tables...</span>
                      </div>
                    </div>
                  </div>
                )}
                
                {fetchingColumns && !identifyingTables && (
                  <div className="text-left">
                    <div className="inline-block bg-gray-100 dark:bg-gray-800 px-4 py-3 rounded-lg">
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                        <span className="text-sm">Fetching column information...</span>
                      </div>
                    </div>
                  </div>
                )}
                
                {generatingSQL && !fetchingColumns && !identifyingTables && (
                  <div className="text-left">
                    <div className="inline-block bg-gray-100 dark:bg-gray-800 px-4 py-3 rounded-lg">
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                        <span className="text-sm">Generating SQL...</span>
                      </div>
                    </div>
                  </div>
                )}
                
                {executingSQL && !generatingSQL && !fetchingColumns && !identifyingTables && (
                  <div className="text-left">
                    <div className="inline-block bg-gray-100 dark:bg-gray-800 px-4 py-3 rounded-lg">
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                        <span className="text-sm">Executing query...</span>
                      </div>
                    </div>
                  </div>
                )}
                
                {evaluating && !executingSQL && !generatingSQL && !fetchingColumns && !identifyingTables && (
                  <div className="text-left">
                    <div className="inline-block bg-gray-100 dark:bg-gray-800 px-4 py-3 rounded-lg">
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                        <span className="text-sm">Evaluating SQL quality...</span>
                      </div>
                    </div>
                  </div>
                )}
                
                {generatingInterpretation && !evaluating && !executingSQL && !generatingSQL && !fetchingColumns && !identifyingTables && (
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
                  placeholder="Ask a question that requires joining tables..."
                  className="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-400"
                  disabled={identifyingTables || fetchingColumns || generatingSQL || executingSQL || evaluating || generatingInterpretation}
                />
                <button
                  onClick={sendMessage}
                  disabled={!currentInput.trim() || identifyingTables || fetchingColumns || generatingSQL || executingSQL || evaluating || generatingInterpretation}
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
