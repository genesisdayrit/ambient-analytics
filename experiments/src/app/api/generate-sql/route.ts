import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { Client } from "pg";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const { env, schema, table, naturalLanguageQuery, columns, sampleData } = await request.json();
    
    if (!env || !schema || !table || !naturalLanguageQuery) {
      return NextResponse.json(
        { error: "Environment, schema, table, and natural language query are required" },
        { status: 400 }
      );
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "OpenAI API key not configured" },
        { status: 500 }
      );
    }

    // Format column information for the prompt
    const columnInfo = columns.map((col: any) => 
      `  - ${col.name}: ${col.type}${col.maxLength ? `(${col.maxLength})` : ''} ${col.nullable ? 'NULL' : 'NOT NULL'}${col.default ? ` DEFAULT ${col.default}` : ''}`
    ).join('\n');

    // Format sample data for context
    const sampleDataStr = sampleData && sampleData.rows.length > 0
      ? JSON.stringify(sampleData.rows.slice(0, 3), null, 2)
      : 'No sample data available';

    // Create the prompt for SQL generation
    const systemPrompt = `You are an expert PostgreSQL SQL query generator. Generate SQL queries based on natural language requests.

Rules:
1. Return ONLY the SQL query, no explanations or markdown formatting
2. Use proper PostgreSQL syntax
3. Always use schema-qualified table names (schema.table)
4. Consider the column types and constraints when generating queries
5. Use appropriate WHERE clauses, JOINs, and aggregations as needed
6. For date/time queries, use PostgreSQL date functions
7. Make queries efficient and use indexes when possible`;

    const userPrompt = `Given the following PostgreSQL table:

Schema: ${schema}
Table: ${table}

Columns:
${columnInfo}

Sample Data (first 3 rows):
${sampleDataStr}

Generate a SQL query for: "${naturalLanguageQuery}"

Return ONLY the SQL query.`;

    // Call OpenAI API
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      temperature: 0.3,
      max_tokens: 500,
    });

    const sql = completion.choices[0]?.message?.content?.trim() || "";

    // Remove markdown code blocks if present
    const cleanedSQL = sql
      .replace(/```sql\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();

    return NextResponse.json({ sql: cleanedSQL });
  } catch (error) {
    console.error("Error generating SQL:", error);
    return NextResponse.json(
      { error: "Failed to generate SQL" },
      { status: 500 }
    );
  }
}

