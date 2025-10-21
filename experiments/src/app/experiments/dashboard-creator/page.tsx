"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Chart, ChartConfiguration, registerables } from 'chart.js';
import ReactFlow, {
  Node,
  Edge,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  NodeTypes,
  BackgroundVariant,
  NodeResizer,
} from 'reactflow';
import 'reactflow/dist/style.css';

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
  chartConfig?: any; // Chart.js configuration
  refinedChartConfig?: any; // Chart for refined results
  error?: string;
  timestamp: Date;
  userQuestion?: string; // Store the original question for refinement
  tablesWithColumns?: TableWithColumns[]; // Store schema context for refinement
}

interface SavedQuery {
  id: string;
  name: string;
  sql: string;
  timestamp: Date;
  userQuestion: string;
  result?: QueryResult;
  isExecuting?: boolean;
}

interface SavedChart {
  id: string;
  name: string;
  chartConfig: any;
  sql: string;
  userQuestion: string;
  timestamp: Date;
  result?: QueryResult;
  isExecuting?: boolean;
}

// Custom Node Components for React Flow
function QueryNode({ data, selected }: { data: SavedQuery & { onRemove: () => void; onReExecute: () => void }; selected?: boolean }) {
  return (
    <div className="bg-white dark:bg-gray-800 border-2 border-blue-400 dark:border-blue-600 rounded-lg p-4 shadow-lg w-full h-full overflow-auto" style={{ minWidth: '350px', minHeight: '200px' }}>
      <NodeResizer 
        color="#3b82f6" 
        isVisible={selected}
        minWidth={350}
        minHeight={200}
      />
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg">📊</span>
            <h4 className="font-semibold text-sm">{data.name}</h4>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">{data.userQuestion}</p>
        </div>
        <button
          onClick={data.onRemove}
          className="text-red-600 hover:text-red-700 text-xs ml-2 p-1"
        >
          ✕
        </button>
      </div>
      <pre className="text-xs font-mono bg-gray-50 dark:bg-gray-900 p-2 rounded overflow-x-auto mb-2 max-h-24">
        {data.sql}
      </pre>
      {data.result && (
        <div className="mb-2">
          <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">
            Results: {data.result.rowCount} rows
          </p>
          <div className="border border-gray-200 dark:border-gray-700 rounded overflow-x-auto max-h-32">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 dark:bg-gray-800 sticky top-0">
                <tr>
                  {data.result.columns.map((col) => (
                    <th key={col} className="px-2 py-1 text-left font-medium whitespace-nowrap">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {data.result.rows.slice(0, 3).map((row, idx) => (
                  <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    {data.result!.columns.map((col) => (
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
      <button
        onClick={data.onReExecute}
        disabled={data.isExecuting}
        className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors w-full"
      >
        {data.isExecuting ? '⏳ Executing...' : '🔄 Re-execute'}
      </button>
    </div>
  );
}

function ChartNode({ data, selected }: { data: SavedChart & { onRemove: () => void; onReExecute: () => void }; selected?: boolean }) {
  return (
    <div className="bg-white dark:bg-gray-800 border-2 border-purple-400 dark:border-purple-600 rounded-lg p-4 shadow-lg w-full h-full flex flex-col" style={{ minWidth: '400px', minHeight: '300px' }}>
      <NodeResizer 
        color="#a855f7" 
        isVisible={selected}
        minWidth={400}
        minHeight={300}
      />
      <div className="flex items-start justify-between mb-2 flex-shrink-0">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg">📈</span>
            <h4 className="font-semibold text-sm">{data.name}</h4>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">{data.userQuestion}</p>
        </div>
        <button
          onClick={data.onRemove}
          className="text-red-600 hover:text-red-700 text-xs ml-2 p-1"
        >
          ✕
        </button>
      </div>
      {data.chartConfig && (
        <div className="mb-2 flex-1 min-h-0">
          <ChartDisplay config={data.chartConfig} />
        </div>
      )}
      <div className="flex-shrink-0">
        <details className="mb-2">
          <summary className="text-xs text-gray-600 dark:text-gray-400 cursor-pointer hover:text-gray-800 dark:hover:text-gray-200">
            View SQL
          </summary>
          <pre className="text-xs font-mono bg-gray-50 dark:bg-gray-900 p-2 rounded overflow-x-auto mt-1 max-h-20 overflow-y-auto">
            {data.sql}
          </pre>
        </details>
        <button
          onClick={data.onReExecute}
          disabled={data.isExecuting}
          className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors w-full"
        >
          {data.isExecuting ? '⏳ Refreshing...' : '🔄 Refresh Data'}
        </button>
      </div>
    </div>
  );
}

// Define custom node types
const nodeTypes: NodeTypes = {
  queryNode: QueryNode,
  chartNode: ChartNode,
};

export default function DashboardCreator() {
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
  const [generatingChart, setGeneratingChart] = useState<string | null>(null); // messageId generating chart for
  const [expandedTables, setExpandedTables] = useState<Set<string>>(new Set());
  const [tableColumns, setTableColumns] = useState<Map<string, Column[]>>(new Map());
  
  // Dashboard state
  const [savedQueries, setSavedQueries] = useState<SavedQuery[]>([]);
  const [savedCharts, setSavedCharts] = useState<SavedChart[]>([]);
  
  // React Flow state
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  
  // Dashboard action callbacks
  const removeSavedQuery = useCallback((queryId: string) => {
    setSavedQueries(prev => prev.filter(q => q.id !== queryId));
  }, []);

  const removeSavedChart = useCallback((chartId: string) => {
    setSavedCharts(prev => prev.filter(c => c.id !== chartId));
  }, []);
  
  const reExecuteSavedQuery = useCallback(async (queryId: string) => {
    const query = savedQueries.find(q => q.id === queryId);
    if (!query) return;

    setSavedQueries(prev => prev.map(q => 
      q.id === queryId ? { ...q, isExecuting: true } : q
    ));

    try {
      const response = await fetch("/api/execute-sql", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ env: selectedEnv, sql: query.sql }),
      });

      if (!response.ok) throw new Error("Failed to execute query");
      const data = await response.json();
      
      if (!data.error) {
        setSavedQueries(prev => prev.map(q => 
          q.id === queryId ? { ...q, result: data.result, isExecuting: false } : q
        ));
      } else {
        setSavedQueries(prev => prev.map(q => 
          q.id === queryId ? { ...q, isExecuting: false } : q
        ));
        alert("Error executing query: " + data.error);
      }
    } catch (err) {
      console.error("Error re-executing query:", err);
      setSavedQueries(prev => prev.map(q => 
        q.id === queryId ? { ...q, isExecuting: false } : q
      ));
    }
  }, [savedQueries, selectedEnv]);

  const reExecuteSavedChart = useCallback(async (chartId: string) => {
    const chart = savedCharts.find(c => c.id === chartId);
    if (!chart) return;

    setSavedCharts(prev => prev.map(c => 
      c.id === chartId ? { ...c, isExecuting: true } : c
    ));

    try {
      const response = await fetch("/api/execute-sql", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ env: selectedEnv, sql: chart.sql }),
      });

      if (!response.ok) throw new Error("Failed to execute query");
      const data = await response.json();
      
      if (!data.error) {
        const chartResponse = await fetch("/api/generate-chart-config", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            naturalLanguageQuery: chart.userQuestion,
            sql: chart.sql,
            result: data.result,
          }),
        });

        if (chartResponse.ok) {
          const chartData = await chartResponse.json();
          setSavedCharts(prev => prev.map(c => 
            c.id === chartId ? { 
              ...c, 
              result: data.result, 
              chartConfig: chartData.chartConfig,
              isExecuting: false 
            } : c
          ));
        } else {
          setSavedCharts(prev => prev.map(c => 
            c.id === chartId ? { ...c, result: data.result, isExecuting: false } : c
          ));
        }
      } else {
        setSavedCharts(prev => prev.map(c => 
          c.id === chartId ? { ...c, isExecuting: false } : c
        ));
        alert("Error executing query: " + data.error);
      }
    } catch (err) {
      console.error("Error re-executing chart:", err);
      setSavedCharts(prev => prev.map(c => 
        c.id === chartId ? { ...c, isExecuting: false } : c
      ));
    }
  }, [savedCharts, selectedEnv]);

  // Sync saved queries and charts to React Flow nodes
  useEffect(() => {
    setNodes((currentNodes) => {
      const newNodes: Node[] = [];
      
      // Add query nodes
      savedQueries.forEach((query, index) => {
        const existingNode = currentNodes.find(n => n.id === `query-${query.id}`);
        newNodes.push({
          id: `query-${query.id}`,
          type: 'queryNode',
          position: existingNode?.position || { x: 50 + (index % 3) * 420, y: 50 + Math.floor(index / 3) * 350 },
          style: existingNode?.style || { width: 380, height: 280 },
          data: {
            ...query,
            onRemove: () => removeSavedQuery(query.id),
            onReExecute: () => reExecuteSavedQuery(query.id),
          },
        });
      });
      
      // Add chart nodes
      savedCharts.forEach((chart, index) => {
        const existingNode = currentNodes.find(n => n.id === `chart-${chart.id}`);
        newNodes.push({
          id: `chart-${chart.id}`,
          type: 'chartNode',
          position: existingNode?.position || { x: 50 + (index % 2) * 650, y: 50 + savedQueries.length * 350 + Math.floor(index / 2) * 450 },
          style: existingNode?.style || { width: 500, height: 400 },
          data: {
            ...chart,
            onRemove: () => removeSavedChart(chart.id),
            onReExecute: () => reExecuteSavedChart(chart.id),
          },
        });
      });
      
      return newNodes;
    });
  }, [savedQueries, savedCharts, removeSavedQuery, removeSavedChart, reExecuteSavedQuery, reExecuteSavedChart]);

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

  const toggleTableExpanded = async (tableName: string) => {
    const newExpanded = new Set(expandedTables);
    if (newExpanded.has(tableName)) {
      newExpanded.delete(tableName);
    } else {
      newExpanded.add(tableName);
      
      // Fetch columns if we don't have them yet
      if (!tableColumns.has(tableName)) {
        try {
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

          if (response.ok) {
            const data = await response.json();
            setTableColumns(prev => new Map(prev).set(tableName, data.columns || []));
          }
        } catch (err) {
          console.error(`Error fetching columns for ${tableName}:`, err);
        }
      }
    }
    setExpandedTables(newExpanded);
  };

  const generateChart = async (messageId: string, useRefined: boolean = false) => {
    const message = messages.find(m => m.id === messageId);
    if (!message) return;

    const resultToUse = useRefined ? message.refinedResult : message.result;
    const sqlToUse = useRefined ? message.refinedSQL : message.sql;

    if (!resultToUse || !message.userQuestion) {
      console.error("Cannot generate chart: missing required data");
      return;
    }

    setGeneratingChart(messageId);

    try {
      const response = await fetch("/api/generate-chart-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          naturalLanguageQuery: message.userQuestion,
          sql: sqlToUse,
          result: resultToUse,
          interpretation: message.interpretation,
        }),
      });

      if (!response.ok) throw new Error("Failed to generate chart config");

      const data = await response.json();
      
      // Update message with chart config
      setMessages(prev => prev.map(msg => 
        msg.id === messageId 
          ? { 
              ...msg, 
              [useRefined ? 'refinedChartConfig' : 'chartConfig']: data.chartConfig 
            } 
          : msg
      ));
    } catch (err) {
      console.error("Error generating chart:", err);
    } finally {
      setGeneratingChart(null);
    }
  };

  // Dashboard-specific functions
  const saveQuery = (messageId: string) => {
    const message = messages.find(m => m.id === messageId);
    if (!message || !message.sql || !message.userQuestion) return;

    const queryName = prompt("Enter a name for this query:", message.userQuestion.substring(0, 50));
    if (!queryName) return;

    const savedQuery: SavedQuery = {
      id: Date.now().toString(),
      name: queryName,
      sql: message.sql,
      userQuestion: message.userQuestion,
      result: message.result,
      timestamp: new Date(),
    };

    setSavedQueries(prev => [...prev, savedQuery]);
  };

  const saveChart = (messageId: string, useRefined: boolean = false) => {
    const message = messages.find(m => m.id === messageId);
    if (!message || !message.userQuestion) return;

    const chartConfig = useRefined ? message.refinedChartConfig : message.chartConfig;
    const sql = useRefined ? message.refinedSQL : message.sql;
    const result = useRefined ? message.refinedResult : message.result;

    if (!chartConfig || !sql) return;

    const chartName = prompt("Enter a name for this chart:", message.userQuestion.substring(0, 50));
    if (!chartName) return;

    const savedChart: SavedChart = {
      id: Date.now().toString(),
      name: chartName,
      chartConfig,
      sql,
      userQuestion: message.userQuestion,
      result,
      timestamp: new Date(),
    };

    setSavedCharts(prev => [...prev, savedChart]);
  };

  return (
    <div className="min-h-screen">
      <div className="p-6">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-4xl mb-8">dashboard creator</h1>
          
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

          {/* Dashboard Section - React Flow Canvas */}
          {(savedQueries.length > 0 || savedCharts.length > 0) && (
            <div className="mb-8">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-semibold">Dashboard Canvas</h2>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  💡 Drag to move, resize handles appear when selected
                </div>
              </div>
              <div className="border-2 border-blue-300 dark:border-blue-700 rounded-lg overflow-hidden" style={{ height: '600px' }}>
                <ReactFlow
                  nodes={nodes}
                  edges={edges}
                  onNodesChange={onNodesChange}
                  onEdgesChange={onEdgesChange}
                  nodeTypes={nodeTypes}
                  fitView
                  className="bg-gradient-to-br from-blue-50 to-purple-50 dark:from-gray-900 dark:to-gray-800"
                >
                  <Background variant={BackgroundVariant.Dots} gap={20} size={1} />
                  <Controls />
                </ReactFlow>
              </div>
            </div>
          )}

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
                <div className="mb-8">
                  <div className="border border-gray-300 dark:border-gray-700 rounded-lg overflow-hidden">
                    <div className="bg-gray-50 dark:bg-gray-800 px-4 py-3">
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {tables.length} tables available in this schema (click a table to view columns)
                      </p>
                    </div>
                    <div className="max-h-40 overflow-y-auto">
                      <div className="px-4 py-2 flex flex-wrap gap-2">
                        {tables.map((table) => (
                          <button
                            key={table.name}
                            onClick={() => toggleTableExpanded(table.name)}
                            className={`inline-block px-3 py-1 border rounded text-xs font-mono transition-colors cursor-pointer ${
                              expandedTables.has(table.name)
                                ? 'bg-blue-100 dark:bg-blue-900 border-blue-400 dark:border-blue-600'
                                : 'bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-600'
                            }`}
                          >
                            {table.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                  
                  {/* Expanded table schemas */}
                  {Array.from(expandedTables).map((tableName) => (
                    <div key={tableName} className="mt-4 border border-gray-300 dark:border-gray-700 rounded-lg overflow-hidden">
                      <div className="bg-gray-50 dark:bg-gray-800 px-4 py-2 flex items-center justify-between">
                        <span className="text-sm font-mono font-semibold">{tableName}</span>
                        <button
                          onClick={() => toggleTableExpanded(tableName)}
                          className="text-xs text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
                        >
                          ✕ Close
                        </button>
                      </div>
                      <div className="p-4">
                        {tableColumns.has(tableName) ? (
                          <div className="border border-gray-200 dark:border-gray-700 rounded overflow-hidden">
                            <table className="w-full text-xs">
                              <thead className="bg-gray-100 dark:bg-gray-800">
                                <tr>
                                  <th className="px-3 py-2 text-left font-medium">Column Name</th>
                                  <th className="px-3 py-2 text-left font-medium">Data Type</th>
                                  <th className="px-3 py-2 text-left font-medium">Nullable</th>
                                  <th className="px-3 py-2 text-left font-medium">Default</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-gray-950">
                                {tableColumns.get(tableName)!.map((column) => (
                                  <tr key={column.name} className="hover:bg-gray-50 dark:hover:bg-gray-900">
                                    <td className="px-3 py-2 font-mono">{column.name}</td>
                                    <td className="px-3 py-2">
                                      {column.type}
                                      {column.maxLength && <span className="text-gray-500">({column.maxLength})</span>}
                                    </td>
                                    <td className="px-3 py-2">
                                      <span className={column.nullable ? "text-gray-600 dark:text-gray-400" : "text-red-600 dark:text-red-400"}>
                                        {column.nullable ? "YES" : "NO"}
                                      </span>
                                    </td>
                                    <td className="px-3 py-2 text-gray-600 dark:text-gray-400 font-mono text-xs">
                                      {column.default || "-"}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 py-2 text-gray-500">
                            <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                            <span className="text-xs">Loading columns...</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
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
                                  <div className="flex items-center justify-between mb-1">
                                    <p className="text-xs font-semibold text-gray-600 dark:text-gray-400">SQL Query:</p>
                                    <button
                                      onClick={() => saveQuery(message.id)}
                                      className="px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                                    >
                                      💾 Save Query
                                    </button>
                                  </div>
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
                                  <div className="relative">
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
                                  <div className="flex items-center justify-between mt-1">
                                    <div>
                                      {!expandedResults.has(message.id) && message.result.rowCount > 5 && (
                                        <p className="text-xs text-gray-500">Showing first 5 of {message.result.rowCount} rows</p>
                                      )}
                                    </div>
                                    {!message.chartConfig && (
                                      <button
                                        onClick={() => generateChart(message.id, false)}
                                        disabled={generatingChart === message.id}
                                        className="px-3 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center gap-1"
                                      >
                                        {generatingChart === message.id ? '⏳ Generating...' : '📊 Generate Chart'}
                                      </button>
                                    )}
                                  </div>
                                  </div>
                                  
                                  {message.chartConfig && (
                                    <div className="mt-3 pt-3 border-t border-gray-300 dark:border-gray-700">
                                      <div className="flex items-center justify-between mb-2">
                                        <p className="text-xs font-semibold text-gray-600 dark:text-gray-400">Visualization</p>
                                        <button
                                          onClick={() => saveChart(message.id, false)}
                                          className="px-2 py-1 text-xs bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors"
                                        >
                                          💾 Save Chart
                                        </button>
                                      </div>
                                      <ChartDisplay config={message.chartConfig} />
                                    </div>
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
                                    <div className="flex items-center justify-between mb-2">
                                      <p className="text-xs font-semibold text-purple-700 dark:text-purple-300">
                                        🔧 Refined SQL
                                      </p>
                                      <button
                                        onClick={() => saveQuery(message.id)}
                                        className="px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                                      >
                                        💾 Save Query
                                      </button>
                                    </div>
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
                                        <div className="relative">
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
                                        {!message.refinedChartConfig && (
                                          <div className="flex justify-end mt-1">
                                            <button
                                              onClick={() => generateChart(message.id, true)}
                                              disabled={generatingChart === message.id}
                                              className="px-3 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center gap-1"
                                            >
                                              {generatingChart === message.id ? '⏳ Generating...' : '📊 Generate Chart'}
                                            </button>
                                          </div>
                                        )}
                                        </div>
                                        
                                        {message.refinedChartConfig && (
                                          <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-600">
                                            <div className="flex items-center justify-between mb-2">
                                              <p className="text-xs font-semibold text-gray-600 dark:text-gray-400">Refined Visualization</p>
                                              <button
                                                onClick={() => saveChart(message.id, true)}
                                                className="px-2 py-1 text-xs bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors"
                                              >
                                                💾 Save Chart
                                              </button>
                                            </div>
                                            <ChartDisplay config={message.refinedChartConfig} />
                                          </div>
                                        )}
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

// Chart Display Component
function ChartDisplay({ config }: { config: ChartConfiguration }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!canvasRef.current || !config) return;

    // Destroy existing chart if it exists
    if (chartRef.current) {
      chartRef.current.destroy();
    }

    // Make chart responsive by ensuring config has responsive options
    const responsiveConfig = {
      ...config,
      options: {
        ...config.options,
        responsive: true,
        maintainAspectRatio: false,
      }
    };

    // Create new chart
    try {
      chartRef.current = new Chart(canvasRef.current, responsiveConfig);
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

  // Handle resize events to update chart
  useEffect(() => {
    const handleResize = () => {
      if (chartRef.current) {
        chartRef.current.resize();
      }
    };

    const resizeObserver = new ResizeObserver(() => {
      handleResize();
    });

    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  return (
    <div ref={containerRef} className="bg-white dark:bg-gray-900 p-4 rounded-lg border border-gray-300 dark:border-gray-700" style={{ height: '100%', minHeight: '200px' }}>
      <div style={{ position: 'relative', height: '100%', width: '100%' }}>
        <canvas ref={canvasRef}></canvas>
      </div>
    </div>
  );
}

