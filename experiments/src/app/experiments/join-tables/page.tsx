"use client";

import { useState, useEffect, useMemo } from "react";
import { ReactFlow, Node, Edge, Background, Controls, MiniMap, Handle, Position, NodeProps } from 'reactflow';
import 'reactflow/dist/style.css';

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

interface ForeignKey {
  fromTable: string;
  fromColumn: string;
  toTable: string;
  toColumn: string;
  constraintName: string;
}

interface TableClassification {
  tableName: string;
  type: 'fact' | 'dimension' | 'bridge';
  reasoning: string;
}

interface OptimizedLayout {
  classifications: TableClassification[];
  positions: {
    [tableName: string]: { x: number; y: number };
  };
}

export default function JoinTables() {
  const [selectedEnv, setSelectedEnv] = useState("");
  const [schemas, setSchemas] = useState<string[]>([]);
  const [selectedSchema, setSelectedSchema] = useState("");
  const [tables, setTables] = useState<Table[]>([]);
  const [tablesWithColumns, setTablesWithColumns] = useState<TableWithColumns[]>([]);
  const [foreignKeys, setForeignKeys] = useState<ForeignKey[]>([]);
  const [optimizedLayout, setOptimizedLayout] = useState<OptimizedLayout | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingTables, setLoadingTables] = useState(false);
  const [loadingColumns, setLoadingColumns] = useState(false);
  const [optimizingLayout, setOptimizingLayout] = useState(false);
  const [error, setError] = useState("");
  const [tablesError, setTablesError] = useState("");

  useEffect(() => {
    if (selectedEnv) {
      fetchSchemas(selectedEnv);
    } else {
      setSchemas([]);
      setSelectedSchema("");
      setTables([]);
    }
  }, [selectedEnv]);

  useEffect(() => {
    if (selectedSchema && selectedEnv) {
      fetchTables(selectedEnv, selectedSchema);
    } else {
      setTables([]);
      setTablesWithColumns([]);
    }
  }, [selectedSchema, selectedEnv]);

  useEffect(() => {
    if (tables.length > 0 && selectedSchema && selectedEnv) {
      fetchAllColumns(selectedEnv, selectedSchema, tables);
    }
  }, [tables, selectedSchema, selectedEnv]);

  useEffect(() => {
    if (tablesWithColumns.length > 0 && selectedSchema && selectedEnv) {
      fetchForeignKeys(selectedEnv, selectedSchema);
    }
  }, [tablesWithColumns, selectedSchema, selectedEnv]);

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
    setLoadingColumns(true);
    
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
      setLoadingColumns(false);
    }
  };

  const fetchForeignKeys = async (env: string, schema: string) => {
    try {
      const response = await fetch("/api/foreign-keys", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ env, schema }),
      });

      if (!response.ok) {
        throw new Error("Failed to fetch foreign keys");
      }

      const data = await response.json();
      setForeignKeys(data.foreignKeys || []);
    } catch (err) {
      console.error("Error fetching foreign keys:", err);
    }
  };

  const optimizeLayout = async () => {
    if (!tablesWithColumns.length || !selectedEnv || !selectedSchema) return;
    
    setOptimizingLayout(true);
    try {
      const response = await fetch("/api/optimize-erd-layout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          tablesWithColumns,
          foreignKeys,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to optimize layout");
      }

      const data = await response.json();
      setOptimizedLayout(data.layout);
    } catch (err) {
      console.error("Error optimizing layout:", err);
    } finally {
      setOptimizingLayout(false);
    }
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
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl">Entity Relationship Diagram - {selectedSchema}</h2>
                {!loadingTables && !loadingColumns && tablesWithColumns.length > 0 && (
                  <button
                    onClick={optimizeLayout}
                    disabled={optimizingLayout}
                    className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                  >
                    {optimizingLayout && (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    )}
                    {optimizingLayout ? 'Optimizing...' : 'Optimize Layout'}
                  </button>
                )}
              </div>
              
              {(loadingTables || loadingColumns) && (
                <p className="text-gray-600 dark:text-gray-400">
                  {loadingTables ? "Loading tables..." : "Loading columns..."}
                </p>
              )}
              
              {tablesError && (
                <p className="text-red-600 dark:text-red-400">{tablesError}</p>
              )}
              
              {!loadingTables && !loadingColumns && !tablesError && tablesWithColumns.length > 0 && (
                <ERDVisualization 
                  tablesWithColumns={tablesWithColumns} 
                  foreignKeys={foreignKeys}
                  optimizedLayout={optimizedLayout}
                />
              )}
              
              {!loadingTables && !tablesError && tables.length === 0 && (
                <p className="text-gray-600 dark:text-gray-400">No tables found in this schema</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Custom node component with column-level handles
function TableNode({ data }: NodeProps) {
  const tableWithCols = data.tableWithCols as TableWithColumns;
  const tableType = data.tableType as 'fact' | 'dimension' | 'bridge' | undefined;
  
  // Determine header color based on table type
  const headerColors = {
    fact: 'bg-orange-600',
    dimension: 'bg-blue-600',
    bridge: 'bg-purple-600',
  };
  
  const headerColor = tableType ? headerColors[tableType] : 'bg-blue-600';
  
  return (
    <div className="w-full">
      {/* Table Header */}
      <div className={`${headerColor} text-white px-3 py-2 font-mono font-semibold text-sm flex items-center justify-between`}>
        <span>{tableWithCols.table}</span>
        {tableType && (
          <span className="text-[10px] opacity-75 uppercase">{tableType}</span>
        )}
      </div>
      
      {/* Columns List */}
      <div className="bg-white">
        {tableWithCols.columns.map((column, idx) => {
          return (
            <div 
              key={column.name}
              className={`px-3 py-1.5 text-xs border-b border-gray-200 relative ${
                idx === tableWithCols.columns.length - 1 ? 'border-b-0' : ''
              }`}
            >
              {/* Left handle for incoming connections */}
              <Handle
                type="target"
                position={Position.Left}
                id={`${tableWithCols.table}-${column.name}-target`}
                style={{ 
                  top: '50%',
                  left: -6,
                  width: 8,
                  height: 8,
                  background: '#2563eb',
                  border: '2px solid white',
                }}
              />
              
              {/* Right handle for outgoing connections */}
              <Handle
                type="source"
                position={Position.Right}
                id={`${tableWithCols.table}-${column.name}-source`}
                style={{ 
                  top: '50%',
                  right: -6,
                  width: 8,
                  height: 8,
                  background: '#2563eb',
                  border: '2px solid white',
                }}
              />
              
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono font-medium text-gray-900 truncate">
                  {column.name}
                </span>
                <span className="text-gray-500 text-[10px] shrink-0">
                  {column.type}
                </span>
              </div>
            </div>
          );
        })}
        {tableWithCols.columns.length === 0 && (
          <div className="px-3 py-2 text-xs text-gray-400 italic">
            No columns
          </div>
        )}
      </div>
    </div>
  );
}

const nodeTypes = {
  tableNode: TableNode,
};

interface ERDVisualizationProps {
  tablesWithColumns: TableWithColumns[];
  foreignKeys: ForeignKey[];
  optimizedLayout: OptimizedLayout | null;
}

function ERDVisualization({ tablesWithColumns, foreignKeys, optimizedLayout }: ERDVisualizationProps) {
  const nodes: Node[] = useMemo(() => {
    // If we have optimized layout, use it; otherwise use grid layout
    if (optimizedLayout) {
      return tablesWithColumns.map((tableWithCols) => {
        const classification = optimizedLayout.classifications.find(
          c => c.tableName === tableWithCols.table
        );
        const position = optimizedLayout.positions[tableWithCols.table] || { x: 0, y: 0 };
        
        return {
          id: tableWithCols.table,
          type: 'tableNode',
          position,
          data: { 
            tableWithCols,
            tableType: classification?.type,
          },
          style: {
            background: 'white',
            border: `2px solid ${
              classification?.type === 'fact' ? '#ea580c' :
              classification?.type === 'bridge' ? '#9333ea' :
              '#2563eb'
            }`,
            borderRadius: '8px',
            fontSize: '12px',
            width: 280,
            padding: 0,
          },
        };
      });
    }
    
    // Default grid layout
    const columns = Math.ceil(Math.sqrt(tablesWithColumns.length));
    const horizontalSpacing = 350;
    const verticalSpacing = 250;
    
    return tablesWithColumns.map((tableWithCols, index) => {
      const row = Math.floor(index / columns);
      const col = index % columns;
      
      return {
        id: tableWithCols.table,
        type: 'tableNode',
        position: { 
          x: col * horizontalSpacing + 50, 
          y: row * verticalSpacing + 50 
        },
        data: { 
          tableWithCols,
          tableType: undefined,
        },
        style: {
          background: 'white',
          border: '2px solid #2563eb',
          borderRadius: '8px',
          fontSize: '12px',
          width: 280,
          padding: 0,
        },
      };
    });
  }, [tablesWithColumns, optimizedLayout]);

  const edges: Edge[] = useMemo(() => {
    return foreignKeys.map((fk, index) => ({
      id: fk.constraintName || `fk-${index}`,
      source: fk.fromTable,
      sourceHandle: `${fk.fromTable}-${fk.fromColumn}-source`,
      target: fk.toTable,
      targetHandle: `${fk.toTable}-${fk.toColumn}-target`,
      type: 'smoothstep',
      animated: false,
      label: `${fk.fromColumn} → ${fk.toColumn}`,
      style: { stroke: '#2563eb', strokeWidth: 2 },
      labelStyle: { fontSize: 10, fill: '#6b7280' },
      labelBgStyle: { fill: 'white', fillOpacity: 0.8 },
    }));
  }, [foreignKeys]);

  return (
    <div className="border border-gray-300 dark:border-gray-700 rounded-lg overflow-hidden" style={{ height: '600px' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        minZoom={0.1}
        maxZoom={2}
      >
        <Background />
        <Controls />
        <MiniMap 
          nodeColor={(node) => {
            const type = node.data?.tableType;
            if (type === 'fact') return '#ea580c';
            if (type === 'bridge') return '#9333ea';
            return '#2563eb';
          }}
        />
      </ReactFlow>
    </div>
  );
}

