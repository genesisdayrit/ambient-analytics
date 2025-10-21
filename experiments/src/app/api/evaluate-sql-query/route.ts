import { NextResponse } from "next/server";
import OpenAI from "openai";

// Single SQL query evaluation endpoint
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { 
      question,
      generatedSQL,
      schema,
      tables,
      executionSuccess = true,
      executionError = null,
      executionResult = null
    } = body;

    if (!question || !generatedSQL) {
      return NextResponse.json(
        { error: "Question and generated SQL are required" },
        { status: 400 }
      );
    }

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    // Build context about the schema
    let schemaContext = "";
    if (tables && tables.length > 0) {
      schemaContext = tables.map((table: any) => {
        const cols = table.columns?.map((col: any) => 
          `    - ${col.name}: ${col.type}`
        ).join('\n') || '';
        return `  ${schema || 'public'}.${table.name}:\n${cols}`;
      }).join('\n\n');
    }

    // Build execution result context
    let executionContext = "";
    if (executionResult && executionSuccess) {
      executionContext = `

Actual Query Results:
- Rows returned: ${executionResult.rowCount || 0}
- Columns: ${executionResult.columns?.join(', ') || 'N/A'}
${executionResult.rows && executionResult.rows.length > 0 ? `
- Sample data (first 3 rows):
${JSON.stringify(executionResult.rows.slice(0, 3), null, 2)}

IMPORTANT: Verify that these results actually answer the user's question. Check if the data, column names, and row count make sense for what was asked.` : ''}`;
    }

    const evaluationPrompt = `You are an expert SQL evaluator. Evaluate the quality of a PostgreSQL query generated from a natural language question.

Consider the following criteria:
1. **Syntax Correctness**: Is the SQL syntactically valid for PostgreSQL?
2. **Semantic Accuracy**: Does the query semantically match what the user asked for?
3. **Schema Usage**: Does it correctly use the provided schema (tables, columns, joins)?
4. **Best Practices**: Does it follow SQL best practices (proper JOINs, qualified table names, etc.)?
5. **Completeness**: Does it fully address the user's question?
6. **Result Accuracy**: ${executionResult ? 'Do the actual results make sense for the question?' : 'No execution results available yet.'}
7. **Execution**: ${executionSuccess ? 'The query executed successfully.' : `The query failed to execute with error: ${executionError}`}

User's Question: "${question}"

${schemaContext ? `Available Schema:
${schemaContext}` : ''}

Generated SQL:
${generatedSQL}
${executionContext}

Provide a score from 0.0 to 1.0 where:
- 1.0 = Perfect, production-ready SQL
- 0.7-0.9 = Good SQL with minor issues
- 0.4-0.6 = Functional but has problems
- 0.0-0.3 = Incorrect or broken SQL

Also provide:
- A brief summary (1-2 sentences)
- Specific strengths (array of strings)
- Specific issues or areas for improvement (array of strings)
- Suggested improvements (optional, string)

Respond with ONLY a JSON object in this exact format:
{
  "score": 0.0,
  "summary": "brief summary here",
  "strengths": ["strength 1", "strength 2"],
  "issues": ["issue 1", "issue 2"],
  "suggestions": "optional suggestions here"
}`;

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

    const evaluation = JSON.parse(response.choices[0].message.content || "{}");
    
    return NextResponse.json({
      success: true,
      evaluation: {
        score: evaluation.score || 0,
        summary: evaluation.summary || "No summary provided",
        strengths: evaluation.strengths || [],
        issues: evaluation.issues || [],
        suggestions: evaluation.suggestions || "",
      },
    });
  } catch (error) {
    console.error("Error evaluating SQL:", error);
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
    description: "Single SQL query evaluation endpoint - provides real-time quality feedback",
  });
}

