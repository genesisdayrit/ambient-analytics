import { NextResponse } from "next/server";
import { wrapOpenAI } from "langsmith/wrappers";
import OpenAI from "openai";
import { traceable } from "langsmith/traceable";

const openai = wrapOpenAI(new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
}));

// Refine SQL based on evaluation feedback and actual results
const refineSQLLogic = traceable(
  async (params: {
    question: string;
    originalSQL: string;
    evaluation: {
      score: number;
      summary: string;
      strengths: string[];
      issues: string[];
      suggestions: string;
    };
    executionResult?: {
      success: boolean;
      rowCount?: number;
      sampleRows?: any[];
      columns?: string[];
      error?: string;
    };
    schema: string;
    schemaContext?: any[];
  }) => {
    const { question, originalSQL, evaluation, executionResult, schema, schemaContext } = params;

    // Build schema context
    let schemaInfo = "";
    if (schemaContext && schemaContext.length > 0) {
      schemaInfo = schemaContext.map((tableInfo: any) => {
        // Handle both formats: { name, columns } and { table, columns }
        const tableName = tableInfo.name || tableInfo.table;
        const cols = tableInfo.columns?.map((col: any) => 
          `    - ${col.name}: ${col.type} ${col.nullable ? 'NULL' : 'NOT NULL'}`
        ).join('\n') || '';
        return `  ${schema}.${tableName}:\n${cols}`;
      }).join('\n\n');
    }

    // Build execution result context
    let executionContext = "";
    if (executionResult) {
      if (executionResult.success) {
        executionContext = `
Execution Result:
- Status: SUCCESS
- Rows returned: ${executionResult.rowCount || 0}
- Columns: ${executionResult.columns?.join(', ') || 'N/A'}
${executionResult.sampleRows && executionResult.sampleRows.length > 0 ? `
- Sample data (first 3 rows):
${JSON.stringify(executionResult.sampleRows.slice(0, 3), null, 2)}` : ''}`;
      } else {
        executionContext = `
Execution Result:
- Status: FAILED
- Error: ${executionResult.error || 'Unknown error'}`;
      }
    }

    const refinementPrompt = `You are an expert PostgreSQL SQL optimizer. Your task is to refine and improve an SQL query based on evaluation feedback and actual execution results.

User's Original Question: "${question}"

Original SQL Query:
${originalSQL}

Quality Evaluation (Score: ${(evaluation.score * 100).toFixed(0)}%):
Summary: ${evaluation.summary}

Strengths:
${evaluation.strengths.map(s => `- ${s}`).join('\n')}

Issues Identified:
${evaluation.issues.map(i => `- ${i}`).join('\n')}

Suggestions:
${evaluation.suggestions}
${executionContext}

Available Schema:
${schemaInfo}

Instructions:
1. Address ALL issues identified in the evaluation
2. Implement the suggestions provided
3. ${executionResult?.success ? 'Ensure the results actually answer the user\'s question based on the sample data' : 'Fix the execution error'}
4. Maintain or improve upon the strengths
5. Follow PostgreSQL best practices
6. Use schema-qualified table names (schema.table)
7. Keep the query efficient and readable

Generate an IMPROVED version of the SQL query that addresses these issues.

IMPORTANT: Return ONLY the improved SQL query, no explanations, no markdown formatting, no comments. Just the raw SQL.`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are an expert PostgreSQL SQL optimizer. Return only the improved SQL query with no additional text or formatting.",
        },
        {
          role: "user",
          content: refinementPrompt,
        },
      ],
      temperature: 0.2,
      max_tokens: 600,
    });

    const refinedSQL = response.choices[0].message.content?.trim() || "";

    // Clean up any potential markdown
    const cleanedSQL = refinedSQL
      .replace(/```sql\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();

    return { refinedSQL: cleanedSQL };
  },
  { name: "refine_sql" }
);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { 
      question,
      originalSQL,
      evaluation,
      executionResult,
      schema,
      schemaContext
    } = body;

    if (!question || !originalSQL || !evaluation) {
      return NextResponse.json(
        { error: "Question, original SQL, and evaluation are required" },
        { status: 400 }
      );
    }

    const result = await refineSQLLogic({
      question,
      originalSQL,
      evaluation,
      executionResult,
      schema,
      schemaContext,
    });

    return NextResponse.json({
      success: true,
      refinedSQL: result.refinedSQL,
    });
  } catch (error) {
    console.error("Error refining SQL:", error);
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
  return NextResponse.json({
    status: "ready",
    description: "SQL refinement endpoint - improves SQL based on evaluation feedback and execution results",
  });
}

