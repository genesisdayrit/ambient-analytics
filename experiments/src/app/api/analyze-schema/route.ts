import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

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

export async function POST(request: NextRequest) {
  try {
    const { env, schema, tablesWithColumns } = await request.json();
    
    if (!env || !schema || !tablesWithColumns) {
      return NextResponse.json(
        { error: "Environment, schema, and tablesWithColumns are required" },
        { status: 400 }
      );
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "OpenAI API key not configured" },
        { status: 500 }
      );
    }

    // Build a comprehensive context of the schema
    const schemaContext = buildSchemaContext(schema, tablesWithColumns);

    // Create the prompt for schema analysis
    const systemPrompt = `You are a database schema analyst expert. Your task is to analyze database schemas and provide insightful, comprehensive summaries.

Your analysis should include:
1. **Overview**: A brief summary of what this schema represents based on table names and structure
2. **Key Tables**: Identify and describe the most important tables
3. **Relationships**: Infer likely relationships between tables based on column names and foreign key patterns
4. **Data Model Insights**: Describe the data model and its purpose
5. **Notable Patterns**: Point out any interesting patterns, naming conventions, or design decisions
6. **Potential Use Cases**: Suggest what kind of application or system this schema might support

Be thorough but concise. Write in a clear, professional manner.`;

    const userPrompt = `Analyze this PostgreSQL schema and provide a comprehensive summary:

${schemaContext}

Please provide a detailed analysis of this schema, including its structure, relationships, and potential purpose.`;

    // Call OpenAI API
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      temperature: 0.7,
      max_tokens: 2000,
    });

    const analysis = completion.choices[0]?.message?.content?.trim() || "";

    return NextResponse.json({ analysis });
  } catch (error) {
    console.error("Error analyzing schema:", error);
    return NextResponse.json(
      { error: "Failed to analyze schema" },
      { status: 500 }
    );
  }
}

function buildSchemaContext(schema: string, tablesWithColumns: TableWithColumns[]): string {
  let context = `Schema: ${schema}\n\n`;
  context += `Total Tables: ${tablesWithColumns.length}\n`;
  context += `Total Columns: ${tablesWithColumns.reduce((sum, t) => sum + t.columns.length, 0)}\n\n`;
  context += `Detailed Table Information:\n`;
  context += `${'='.repeat(80)}\n\n`;

  tablesWithColumns.forEach((tableWithCols, idx) => {
    context += `${idx + 1}. Table: ${schema}.${tableWithCols.table} (${tableWithCols.type})\n`;
    context += `   Columns (${tableWithCols.columns.length}):\n`;
    
    tableWithCols.columns.forEach((col) => {
      const typeStr = col.maxLength 
        ? `${col.type}(${col.maxLength})`
        : col.type;
      const nullable = col.nullable ? 'NULL' : 'NOT NULL';
      const defaultStr = col.default ? ` DEFAULT ${col.default}` : '';
      
      context += `   - ${col.name}: ${typeStr} ${nullable}${defaultStr}\n`;
    });
    
    context += '\n';
  });

  return context;
}

