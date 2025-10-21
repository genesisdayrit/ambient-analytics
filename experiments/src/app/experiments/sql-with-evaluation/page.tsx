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

interface SampleData {
  columns: string[];
  rows: Record<string, any>[];
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
}

export default function SQLWithEvaluation() {
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
  const [generatingSQL, setGeneratingSQL] = useState(false);
  const [evaluating, setEvaluating] = useState(false);
  const [executingSQL, setExecutingSQL] = useState(false);
  const [generatingInterpretation, setGeneratingInterpretation] = useState(false);
  const [refiningSQL, setRefiningSQL] = useState<string | null>(null); // messageId being refined

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
    try {
      const response = await fetch("/api/schemas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ env }),
      });
      const data = await response.json();
      setSchemas(data.schemas || []);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchTables = async (env: string, schema: string) => {
    try {
      const response = await fetch("/api/tables", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ env, schema }),
      });
      const data = await response.json();
      setTables(data.tables || []);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchColumns = async (env: string, schema: string, table: string) => {
    try {
      const response = await fetch("/api/columns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ env, schema, table }),
      });
      const data = await response.json();
      setColumns(data.columns || []);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchSampleData = async (env: string, schema: string, table: string) => {
    try {
      const response = await fetch("/api/sample-data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ env, schema, table }),
      });
      const data = await response.json();
      setSampleData(data);
    } catch (err) {
      console.error(err);
    }
  };

  const sendMessage = async () => {
    if (!currentInput.trim()) return;

    const userQuestion = currentInput;
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: userQuestion,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setCurrentInput("");

    const assistantMessageId = (Date.now() + 1).toString();
    const assistantMessage: Message = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      userQuestion, // Store for refinement
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, assistantMessage]);

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
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          env: selectedEnv,
          schema: selectedSchema,
          table: selectedTable,
          naturalLanguageQuery: userQuestion,
          columns,
          sampleData,
          conversationContext,
        }),
      });

      if (!response.ok) throw new Error("Failed to generate SQL");

      const data = await response.json();
      sql = data.sql || "";
      
      setMessages(prev => prev.map(msg => 
        msg.id === assistantMessageId ? { ...msg, sql } : msg
      ));
    } catch (err) {
      setMessages(prev => prev.map(msg => 
        msg.id === assistantMessageId ? { ...msg, error: "Failed to generate SQL" } : msg
      ));
      console.error(err);
      setGeneratingSQL(false);
      return;
    }
    
    setGeneratingSQL(false);

    // Step 2: Execute SQL (do this before evaluation so we can pass results)
    setExecutingSQL(true);
    let result: QueryResult | undefined = undefined;
    let executionError: string | null = null;
    
    try {
      const response = await fetch("/api/execute-sql", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ env: selectedEnv, sql }),
      });

      if (!response.ok) throw new Error("Failed to execute SQL");

      const data = await response.json();
      
      if (data.error) {
        executionError = data.error;
        setMessages(prev => prev.map(msg => 
          msg.id === assistantMessageId ? { ...msg, error: data.error } : msg
        ));
      } else {
        result = data.result;
        setMessages(prev => prev.map(msg => 
          msg.id === assistantMessageId ? { ...msg, result } : msg
        ));
      }
    } catch (err) {
      executionError = "Failed to execute SQL";
      setMessages(prev => prev.map(msg => 
        msg.id === assistantMessageId ? { ...msg, error: executionError! } : msg
      ));
      console.error(err);
    }
    
    setExecutingSQL(false);

    // Step 3: Evaluate SQL Quality (with execution results)
    setEvaluating(true);
    let evaluation: SQLEvaluation | undefined = undefined;
    
    try {
      const response = await fetch("/api/evaluate-sql-query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: userQuestion,
          generatedSQL: sql,
          schema: selectedSchema,
          tables: [{ name: selectedTable, columns }],
          executionSuccess: !executionError,
          executionError,
          executionResult: result, // Pass actual results
        }),
      });

      if (!response.ok) throw new Error("Failed to evaluate SQL");

      const data = await response.json();
      evaluation = data.evaluation;
      
      setMessages(prev => prev.map(msg => 
        msg.id === assistantMessageId ? { ...msg, evaluation } : msg
      ));
    } catch (err) {
      console.error("Evaluation error:", err);
    }
    
    setEvaluating(false);

    // Step 4: Generate interpretation (if we have results)
    if (result) {
      setGeneratingInterpretation(true);
      
      try {
        const response = await fetch("/api/interpret-results", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            question: userQuestion,
            sql,
            result,
          }),
        });

        if (!response.ok) throw new Error("Failed to interpret results");

        const data = await response.json();
        const interpretation = data.interpretation || "";
        
        setMessages(prev => prev.map(msg => 
          msg.id === assistantMessageId ? { ...msg, interpretation, content: interpretation } : msg
        ));
      } catch (err) {
        console.error(err);
      }
      
      setGeneratingInterpretation(false);
    }
  };

  const refineSQL = async (messageId: string) => {
    const message = messages.find(m => m.id === messageId);
    if (!message || !message.sql || !message.evaluation || !message.userQuestion) {
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
          schemaContext: [{ name: selectedTable, columns }],
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
              tables: [{ name: selectedTable, columns }],
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

  const toggleResultExpanded = (messageId: string) => {
    setExpandedResults(prev => {
      const newSet = new Set(prev);
      if (newSet.has(messageId)) {
        newSet.delete(messageId);
      } else {
        newSet.add(messageId);
      }
      return newSet;
    });
  };

  const getScoreColor = (score: number) => {
    if (score >= 0.9) return "text-green-600 dark:text-green-400";
    if (score >= 0.7) return "text-blue-600 dark:text-blue-400";
    if (score >= 0.5) return "text-yellow-600 dark:text-yellow-400";
    return "text-red-600 dark:text-red-400";
  };

  const getScoreBgColor = (score: number) => {
    if (score >= 0.9) return "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800";
    if (score >= 0.7) return "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800";
    if (score >= 0.5) return "bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800";
    return "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800";
  };

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-4xl mb-2">SQL Chat with Real-Time Evaluation</h1>
        <p className="text-gray-600 dark:text-gray-400 mb-8">
          Ask questions in natural language and get instant quality feedback on generated SQL
        </p>

        {/* Configuration Panel */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div>
            <label className="block text-sm mb-1 font-semibold">Environment</label>
            <select
              value={selectedEnv}
              onChange={(e) => setSelectedEnv(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded bg-white dark:bg-gray-900"
            >
              <option value="">Select environment</option>
              <option value="demo">Demo</option>
            </select>
          </div>

          <div>
            <label className="block text-sm mb-1 font-semibold">Schema</label>
            <select
              value={selectedSchema}
              onChange={(e) => setSelectedSchema(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded bg-white dark:bg-gray-900"
              disabled={!schemas.length}
            >
              <option value="">Select schema</option>
              {schemas.map((schema) => (
                <option key={schema} value={schema}>{schema}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm mb-1 font-semibold">Table</label>
            <select
              value={selectedTable}
              onChange={(e) => setSelectedTable(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded bg-white dark:bg-gray-900"
              disabled={!tables.length}
            >
              <option value="">Select table</option>
              {tables.map((table) => (
                <option key={table.name} value={table.name}>{table.name}</option>
              ))}
            </select>
          </div>

          <div className="flex items-end">
            <div className="text-sm text-gray-600 dark:text-gray-400">
              {columns.length > 0 && <span>{columns.length} columns loaded</span>}
            </div>
          </div>
        </div>

        {/* Chat Interface */}
        <div className="border border-gray-300 dark:border-gray-700 rounded-lg overflow-hidden bg-white dark:bg-gray-900">
          {/* Messages */}
          <div className="h-[600px] overflow-y-auto p-6 space-y-6">
            {messages.length === 0 ? (
              <div className="text-center text-gray-500 dark:text-gray-400 mt-20">
                <p className="text-lg mb-2">Select a database, schema, and table to start</p>
                <p className="text-sm">Then ask questions in natural language</p>
                <div className="mt-6 text-left inline-block">
                  <p className="font-semibold mb-2">Example questions:</p>
                  <ul className="text-sm space-y-1">
                    <li>• "Show me the top 10 records"</li>
                    <li>• "How many users signed up last month?"</li>
                    <li>• "What's the average order value by customer?"</li>
                  </ul>
                </div>
              </div>
            ) : (
              messages.map((message) => (
                <div key={message.id} className={`${message.role === 'user' ? 'text-right' : 'text-left'}`}>
                  {message.role === 'user' ? (
                    <div className="inline-block max-w-[80%] px-4 py-2 rounded-lg bg-blue-500 text-white">
                      {message.content}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {/* SQL Query */}
                      {message.sql && (
                        <div className="border border-gray-300 dark:border-gray-700 rounded-lg p-4 bg-gray-50 dark:bg-gray-800">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-semibold">Generated SQL</span>
                          </div>
                          <pre className="text-sm bg-gray-900 text-gray-100 p-3 rounded overflow-x-auto">
                            <code>{message.sql}</code>
                          </pre>
                        </div>
                      )}

                      {/* Evaluation Feedback */}
                      {message.evaluation && (
                        <div className={`border rounded-lg p-4 ${getScoreBgColor(message.evaluation.score)}`}>
                          <div className="flex items-center justify-between mb-3">
                            <span className="text-sm font-semibold">Quality Evaluation</span>
                            <span className={`text-2xl font-bold ${getScoreColor(message.evaluation.score)}`}>
                              {(message.evaluation.score * 100).toFixed(0)}%
                            </span>
                          </div>
                          
                          <p className="text-sm mb-3">{message.evaluation.summary}</p>
                          
                          {message.evaluation.strengths.length > 0 && (
                            <div className="mb-2">
                              <p className="text-xs font-semibold text-green-700 dark:text-green-300 mb-1">Strengths:</p>
                              <ul className="text-xs space-y-1">
                                {message.evaluation.strengths.map((strength, i) => (
                                  <li key={i} className="flex items-start">
                                    <span className="text-green-600 dark:text-green-400 mr-2">✓</span>
                                    <span>{strength}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                          
                          {message.evaluation.issues.length > 0 && (
                            <div className="mb-2">
                              <p className="text-xs font-semibold text-orange-700 dark:text-orange-300 mb-1">Issues:</p>
                              <ul className="text-xs space-y-1">
                                {message.evaluation.issues.map((issue, i) => (
                                  <li key={i} className="flex items-start">
                                    <span className="text-orange-600 dark:text-orange-400 mr-2">⚠</span>
                                    <span>{issue}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                          
                          {message.evaluation.suggestions && (
                            <div className="mt-3 pt-3 border-t border-gray-300 dark:border-gray-600">
                              <p className="text-xs font-semibold mb-1">Suggestions:</p>
                              <p className="text-xs text-gray-700 dark:text-gray-300">{message.evaluation.suggestions}</p>
                            </div>
                          )}

                          {/* Improve SQL Button */}
                          {message.evaluation.score < 0.9 && !message.refinedSQL && (
                            <div className="mt-3 pt-3 border-t border-gray-300 dark:border-gray-600">
                              <button
                                onClick={() => refineSQL(message.id)}
                                disabled={refiningSQL === message.id}
                                className="w-full px-4 py-2 bg-gradient-to-r from-purple-500 to-indigo-500 text-white rounded-lg hover:from-purple-600 hover:to-indigo-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed font-medium text-sm"
                              >
                                {refiningSQL === message.id ? 'Improving SQL...' : '✨ Improve SQL Automatically'}
                              </button>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Refined SQL Comparison */}
                      {message.refinedSQL && (
                        <div className="border-2 border-purple-300 dark:border-purple-700 rounded-lg p-4 bg-purple-50 dark:bg-purple-900/20">
                          <div className="flex items-center gap-2 mb-3">
                            <span className="text-lg">✨</span>
                            <span className="text-sm font-bold text-purple-700 dark:text-purple-300">Improved Version</span>
                            {message.refinedEvaluation && (
                              <span className={`ml-auto text-xl font-bold ${getScoreColor(message.refinedEvaluation.score)}`}>
                                {(message.refinedEvaluation.score * 100).toFixed(0)}%
                                {message.evaluation && message.refinedEvaluation.score > message.evaluation.score && (
                                  <span className="text-sm ml-2 text-green-600 dark:text-green-400">
                                    (+{((message.refinedEvaluation.score - message.evaluation.score) * 100).toFixed(0)}%)
                                  </span>
                                )}
                              </span>
                            )}
                          </div>

                          <pre className="text-sm bg-gray-900 text-gray-100 p-3 rounded overflow-x-auto mb-3">
                            <code>{message.refinedSQL}</code>
                          </pre>

                          {message.refinedEvaluation && (
                            <div className="text-xs space-y-2">
                              {message.refinedEvaluation.summary && (
                                <p className="text-gray-700 dark:text-gray-300">{message.refinedEvaluation.summary}</p>
                              )}
                              {message.refinedEvaluation.strengths.length > 0 && (
                                <div>
                                  <p className="font-semibold text-green-700 dark:text-green-300">Improvements:</p>
                                  <ul className="space-y-1 mt-1">
                                    {message.refinedEvaluation.strengths.map((strength, i) => (
                                      <li key={i} className="flex items-start">
                                        <span className="text-green-600 dark:text-green-400 mr-2">✓</span>
                                        <span>{strength}</span>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </div>
                          )}

                          {message.refinedResult && (
                            <div className="mt-3 pt-3 border-t border-purple-300 dark:border-purple-700">
                              <p className="text-xs font-semibold mb-2">Refined Query Results ({message.refinedResult.rowCount} rows)</p>
                              <div className="overflow-x-auto max-h-60 overflow-y-auto">
                                <table className="min-w-full text-xs">
                                  <thead className="bg-gray-100 dark:bg-gray-700 sticky top-0">
                                    <tr>
                                      {message.refinedResult.columns.map((col) => (
                                        <th key={col} className="px-3 py-2 text-left font-semibold">{col}</th>
                                      ))}
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {message.refinedResult.rows.slice(0, 5).map((row, i) => (
                                      <tr key={i} className="border-t border-gray-200 dark:border-gray-700">
                                        {message.refinedResult!.columns.map((col) => (
                                          <td key={col} className="px-3 py-2">
                                            {row[col] != null ? String(row[col]) : <span className="text-gray-400">null</span>}
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
                      )}

                      {/* Original Query Results */}
                      {message.result && (
                        <div className="border border-gray-300 dark:border-gray-700 rounded-lg p-4 bg-white dark:bg-gray-800">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-semibold">Results ({message.result.rowCount} rows)</span>
                            <button
                              onClick={() => toggleResultExpanded(message.id)}
                              className="text-sm text-blue-500 hover:text-blue-600"
                            >
                              {expandedResults.has(message.id) ? 'Show Less' : 'Show More'}
                            </button>
                          </div>
                          <div className="overflow-x-auto">
                            <table className="min-w-full text-sm">
                              <thead className="bg-gray-100 dark:bg-gray-700">
                                <tr>
                                  {message.result.columns.map((col) => (
                                    <th key={col} className="px-3 py-2 text-left font-semibold">{col}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {message.result.rows.slice(0, expandedResults.has(message.id) ? undefined : 5).map((row, i) => (
                                  <tr key={i} className="border-t border-gray-200 dark:border-gray-700">
                                    {message.result!.columns.map((col) => (
                                      <td key={col} className="px-3 py-2">
                                        {row[col] != null ? String(row[col]) : <span className="text-gray-400">null</span>}
                                      </td>
                                    ))}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}

                      {/* Interpretation */}
                      {message.interpretation && (
                        <div className="px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-800">
                          {message.interpretation}
                        </div>
                      )}

                      {/* Error */}
                      {message.error && (
                        <div className="px-4 py-2 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300">
                          Error: {message.error}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))
            )}

            {/* Loading States */}
            {(generatingSQL || evaluating || executingSQL || generatingInterpretation) && (
              <div className="text-left text-gray-500 dark:text-gray-400">
                <div className="inline-block px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-800">
                  {generatingSQL && "Generating SQL..."}
                  {evaluating && "Evaluating SQL quality..."}
                  {executingSQL && "Executing query..."}
                  {generatingInterpretation && "Interpreting results..."}
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <div className="border-t border-gray-300 dark:border-gray-700 p-4 bg-gray-50 dark:bg-gray-800">
            <div className="flex gap-2">
              <input
                type="text"
                value={currentInput}
                onChange={(e) => setCurrentInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                placeholder="Ask a question in natural language..."
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900"
                disabled={!selectedTable || generatingSQL || evaluating || executingSQL || generatingInterpretation}
              />
              <button
                onClick={sendMessage}
                disabled={!currentInput.trim() || !selectedTable || generatingSQL || evaluating || executingSQL || generatingInterpretation}
                className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Send
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

