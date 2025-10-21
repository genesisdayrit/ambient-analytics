import { NextResponse } from "next/server";
import { Client } from "langsmith";
import { createLLMAsJudge } from "openevals";
import { wrapOpenAI } from "langsmith/wrappers";
import OpenAI from "openai";
import { evaluate } from "langsmith/evaluation";

// Use a simpler custom evaluator that works with the actual data structure
async function createSQLCorrectnessEvaluator() {
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  return async (params: {
    inputs: Record<string, unknown>;
    outputs: Record<string, unknown>;
    referenceOutputs?: Record<string, unknown>;
  }) => {
    const question = params.inputs.question || "";
    const actualSQL = (params.outputs as any).sql || "";
    const expectedSQL = params.referenceOutputs?.sql || "";
    const explanation = params.referenceOutputs?.explanation || "";

    const evaluationPrompt = `You are an expert SQL evaluator. Evaluate whether the generated SQL query correctly answers the user's natural language question.

Consider the following criteria:
1. **Syntax Correctness**: Is the SQL syntactically valid for PostgreSQL?
2. **Semantic Accuracy**: Does the query semantically match what the user asked for?
3. **Schema Usage**: Does it correctly use the provided schema (tables, columns, joins)?
4. **Best Practices**: Does it follow SQL best practices (proper JOINs, qualified table names, etc.)?
5. **Completeness**: Does it fully address the user's question?

User's Question: "${question}"

Expected Behavior: ${explanation}
Reference SQL: ${expectedSQL}

Generated SQL: ${actualSQL}

Provide a score from 0.0 to 1.0 where:
- 1.0 = Perfect, production-ready SQL
- 0.7-0.9 = Good SQL with minor issues
- 0.4-0.6 = Functional but has problems
- 0.0-0.3 = Incorrect or broken SQL

Respond with ONLY a JSON object in this exact format:
{"score": 0.0, "reasoning": "your detailed reasoning here"}`;

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "You are an expert SQL evaluator. Always respond with valid JSON only.",
          },
          {
            role: "user",
            content: evaluationPrompt,
          },
        ],
        temperature: 0.2,
        response_format: { type: "json_object" },
      });

      const result = JSON.parse(response.choices[0].message.content || "{}");
      
      return {
        key: "sql_correctness",
        score: result.score,
        comment: result.reasoning,
      };
    } catch (error) {
      console.error("Error in SQL evaluator:", error);
      return {
        key: "sql_correctness",
        score: 0,
        comment: `Evaluation failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  };
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { 
      datasetName = "SQL Generation Evaluation Dataset",
      experimentPrefix = "sql-eval"
    } = body;

    // Initialize LangSmith client
    const client = new Client({
      apiKey: process.env.LANGSMITH_API_KEY,
    });

    // Check if dataset already exists, if not create it
    let dataset;
    try {
      const datasets = await client.listDatasets({ datasetName });
      const existingDatasets = [];
      for await (const ds of datasets) {
        existingDatasets.push(ds);
      }
      
      if (existingDatasets.length > 0) {
        dataset = existingDatasets[0];
        console.log(`Using existing dataset: ${dataset.id}`);
      } else {
        throw new Error("Dataset not found");
      }
    } catch (error) {
      // Create new dataset with SQL-specific examples
      dataset = await client.createDataset(datasetName, {
        description: "Test cases for evaluating SQL generation from natural language queries.",
      });
      console.log(`Created new dataset: ${dataset.id}`);

      // SQL-specific test examples
      const examples = [
        {
          inputs: { 
            question: "Show me all users who signed up in the last 30 days",
            schema: "public",
            tables: JSON.stringify([{
              table: "users",
              columns: [
                { name: "id", type: "integer" },
                { name: "email", type: "varchar" },
                { name: "created_at", type: "timestamp" },
                { name: "name", type: "varchar" }
              ]
            }])
          },
          outputs: { 
            sql: "SELECT * FROM public.users WHERE created_at >= NOW() - INTERVAL '30 days'",
            explanation: "Should filter users by created_at date within last 30 days"
          },
        },
        {
          inputs: { 
            question: "Get the total number of orders per customer",
            schema: "public",
            tables: JSON.stringify([{
              table: "orders",
              columns: [
                { name: "id", type: "integer" },
                { name: "customer_id", type: "integer" },
                { name: "total", type: "decimal" },
                { name: "created_at", type: "timestamp" }
              ]
            }, {
              table: "customers",
              columns: [
                { name: "id", type: "integer" },
                { name: "name", type: "varchar" },
                { name: "email", type: "varchar" }
              ]
            }])
          },
          outputs: { 
            sql: "SELECT c.name, COUNT(o.id) as order_count FROM public.customers c LEFT JOIN public.orders o ON c.id = o.customer_id GROUP BY c.id, c.name",
            explanation: "Should join customers with orders, count orders per customer, and use LEFT JOIN to include customers with zero orders"
          },
        },
        {
          inputs: { 
            question: "Find the top 5 products by revenue in the last quarter",
            schema: "public",
            tables: JSON.stringify([{
              table: "order_items",
              columns: [
                { name: "id", type: "integer" },
                { name: "order_id", type: "integer" },
                { name: "product_id", type: "integer" },
                { name: "quantity", type: "integer" },
                { name: "price", type: "decimal" }
              ]
            }, {
              table: "products",
              columns: [
                { name: "id", type: "integer" },
                { name: "name", type: "varchar" },
                { name: "category", type: "varchar" }
              ]
            }, {
              table: "orders",
              columns: [
                { name: "id", type: "integer" },
                { name: "created_at", type: "timestamp" }
              ]
            }])
          },
          outputs: { 
            sql: "SELECT p.name, SUM(oi.quantity * oi.price) as revenue FROM public.products p JOIN public.order_items oi ON p.id = oi.product_id JOIN public.orders o ON oi.order_id = o.id WHERE o.created_at >= DATE_TRUNC('quarter', NOW()) - INTERVAL '3 months' AND o.created_at < DATE_TRUNC('quarter', NOW()) GROUP BY p.id, p.name ORDER BY revenue DESC LIMIT 5",
            explanation: "Should calculate revenue per product, filter by last quarter, and return top 5"
          },
        },
        {
          inputs: { 
            question: "List all products that have never been ordered",
            schema: "public",
            tables: JSON.stringify([{
              table: "products",
              columns: [
                { name: "id", type: "integer" },
                { name: "name", type: "varchar" },
                { name: "price", type: "decimal" }
              ]
            }, {
              table: "order_items",
              columns: [
                { name: "id", type: "integer" },
                { name: "product_id", type: "integer" },
                { name: "quantity", type: "integer" }
              ]
            }])
          },
          outputs: { 
            sql: "SELECT p.* FROM public.products p LEFT JOIN public.order_items oi ON p.id = oi.product_id WHERE oi.id IS NULL",
            explanation: "Should use LEFT JOIN and filter for NULL to find products with no orders"
          },
        },
        {
          inputs: { 
            question: "Calculate the average order value by month for 2024",
            schema: "public",
            tables: JSON.stringify([{
              table: "orders",
              columns: [
                { name: "id", type: "integer" },
                { name: "total", type: "decimal" },
                { name: "created_at", type: "timestamp" }
              ]
            }])
          },
          outputs: { 
            sql: "SELECT DATE_TRUNC('month', created_at) as month, AVG(total) as avg_order_value FROM public.orders WHERE EXTRACT(YEAR FROM created_at) = 2024 GROUP BY DATE_TRUNC('month', created_at) ORDER BY month",
            explanation: "Should group by month, calculate average, and filter for 2024"
          },
        },
      ];

      // Add examples to the dataset
      await client.createExamples({
        inputs: examples.map((ex: { inputs: Record<string, unknown> }) => ex.inputs),
        outputs: examples.map((ex: { outputs: Record<string, unknown> }) => ex.outputs),
        datasetId: dataset.id,
      });
      console.log(`Added ${examples.length} SQL examples to dataset`);
    }

    // Wrap the OpenAI client for LangSmith tracing
    const openai = wrapOpenAI(new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    }));

    // Define the target function - SQL generation
    async function generateSQL(inputs: {
      question: string;
      schema: string;
      tables: string;
    }): Promise<{ sql: string }> {
      const tablesData = JSON.parse(inputs.tables);
      
      // Format schema context
      const schemaContext = tablesData.map((tableInfo: any) => {
        const cols = tableInfo.columns.map((col: any) => 
          `    - ${col.name}: ${col.type}`
        ).join('\n');
        return `  ${inputs.schema}.${tableInfo.table}:\n${cols}`;
      }).join('\n\n');

      const systemPrompt = `You are an expert PostgreSQL SQL query generator. Generate SQL queries based on natural language requests.

Rules:
1. Return ONLY the SQL query, no explanations or markdown formatting
2. Use proper PostgreSQL syntax
3. Always use schema-qualified table names (schema.table)
4. Consider the column types when generating queries
5. Use appropriate WHERE clauses, JOINs, and aggregations as needed
6. For date/time queries, use PostgreSQL date functions
7. Make queries efficient`;

      const userPrompt = `Given the following PostgreSQL schema:

Schema: ${inputs.schema}

Available Tables and Columns:
${schemaContext}

Generate a SQL query for: "${inputs.question}"

Return ONLY the SQL query.`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.3,
        max_tokens: 500,
      });

      const sql = response.choices[0].message.content?.trim() || "";
      
      // Clean up the SQL
      const cleanedSQL = sql
        .replace(/```sql\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();

      return { sql: cleanedSQL };
    }

    // Create the SQL correctness evaluator
    const sqlCorrectnessEvaluator = await createSQLCorrectnessEvaluator();

    // Run the evaluation
    const results = await evaluate(generateSQL, {
      data: datasetName,
      evaluators: [sqlCorrectnessEvaluator],
      experimentPrefix,
      maxConcurrency: 2,
    });

    return NextResponse.json({
      success: true,
      message: "SQL evaluation completed successfully",
      datasetId: dataset.id,
      datasetName,
      results: {
        experimentPrefix,
        message: "Check LangSmith UI for detailed SQL evaluation results including syntax, semantic accuracy, and best practices scores",
      },
    });
  } catch (error) {
    console.error("Error running SQL evaluation:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error occurred",
      },
      { status: 500 }
    );
  }
}

// GET endpoint to check API status
export async function GET() {
  const hasLangSmithKey = !!process.env.LANGSMITH_API_KEY;
  const hasOpenAIKey = !!process.env.OPENAI_API_KEY;
  
  return NextResponse.json({
    status: "ready",
    configuration: {
      langsmithConfigured: hasLangSmithKey,
      openaiConfigured: hasOpenAIKey,
    },
    description: "SQL generation evaluation endpoint - evaluates SQL query quality, syntax, and semantic correctness",
  });
}

