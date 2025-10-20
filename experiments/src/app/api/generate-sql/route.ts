import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { Client } from "pg";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const { env, schema, table, naturalLanguageQuery, columns, sampleData, conversationContext, schemaContext } = await request.json();
    
    if (!env || !schema || !naturalLanguageQuery) {
      return NextResponse.json(
        { error: "Environment, schema, and natural language query are required" },
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
    let columnInfo = '';
    if (schemaContext && schemaContext.length > 0) {
      // Build comprehensive schema information
      columnInfo = schemaContext.map((tableInfo: any) => {
        const cols = tableInfo.columns.map((col: any) => 
          `    - ${col.name}: ${col.type} ${col.nullable ? 'NULL' : 'NOT NULL'}`
        ).join('\n');
        return `  ${schema}.${tableInfo.table}:\n${cols}`;
      }).join('\n\n');
    } else if (columns && columns.length > 0) {
      columnInfo = columns.map((col: any) => 
        `  - ${col.name}: ${col.type}${col.maxLength ? `(${col.maxLength})` : ''} ${col.nullable ? 'NULL' : 'NOT NULL'}${col.default ? ` DEFAULT ${col.default}` : ''}`
      ).join('\n');
    }

    // Format sample data for context
    const sampleDataStr = sampleData && sampleData.rows.length > 0
      ? JSON.stringify(sampleData.rows.slice(0, 3), null, 2)
      : '';

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

    // Build conversation history if provided
    let conversationHistory = '';
    if (conversationContext && conversationContext.length > 0) {
      conversationHistory = '\n\nConversation History:\n' + conversationContext.map((msg: any, idx: number) => {
        let text = `${idx + 1}. ${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`;
        if (msg.sql) text += `\n   SQL: ${msg.sql}`;
        if (msg.result) text += `\n   Result: ${msg.result.rowCount} rows`;
        return text;
      }).join('\n');
    }

    const tableInfo = table ? `Specific Table: ${table}` : 'Query across any tables in the schema as needed';
    
    const userPrompt = `Given the following PostgreSQL schema:

Schema: ${schema}
${tableInfo}

${columnInfo ? `Available Tables and Columns:
${columnInfo}` : ''}

${sampleDataStr ? `Sample Data (first 3 rows):
${sampleDataStr}` : ''}
${conversationHistory}

Generate a SQL query for: "${naturalLanguageQuery}"

Important:
- Always use fully qualified table names (schema.table)
- Use appropriate JOINs if the query requires data from multiple tables
- Make sure to infer relationships between tables based on column names
${conversationHistory ? '- Consider the conversation history and build upon previous queries if relevant' : ''}

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

