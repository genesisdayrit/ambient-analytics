import { NextResponse } from "next/server";
import OpenAI from "openai";
import { wrapOpenAI } from "langsmith/wrappers";
import { traceable } from "langsmith/traceable";

const openai = wrapOpenAI(new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
}));

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

const generateJoinedSQLLogic = traceable(
  async (params: {
    schema: string;
    query: string;
    tablesWithColumns: TableWithColumns[];
    conversationContext?: any[];
  }) => {
    const { schema, query, tablesWithColumns, conversationContext } = params;

    // Build the schema information for the prompt
    const schemaInfo = tablesWithColumns.map((twc: TableWithColumns) => {
      const columnsInfo = twc.columns.map(col => 
        `  - ${col.name} (${col.type}${col.nullable ? ', nullable' : ', not null'})`
      ).join('\n');
      
      return `Table: ${twc.table}\nColumns:\n${columnsInfo}`;
    }).join('\n\n');

    // Build conversation history if provided
    let conversationHistory = '';
    if (conversationContext && conversationContext.length > 0) {
      conversationHistory = '\n\nConversation History:\n' + conversationContext.map((msg: any, idx: number) => {
        let text = `${idx + 1}. ${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`;
        if (msg.relevantTables && msg.relevantTables.length > 0) {
          text += `\n   Tables used: ${msg.relevantTables.join(', ')}`;
        }
        if (msg.sql) text += `\n   SQL: ${msg.sql}`;
        if (msg.result) text += `\n   Result: ${msg.result.rowCount} rows`;
        return text;
      }).join('\n') + '\n';
    }

    const prompt = `You are a SQL expert. Given a natural language query and database schema information, generate a SQL query that joins the relevant tables to answer the user's question.
${conversationHistory}
Current User Query: "${query}"

Database Schema:
${schemaInfo}

Instructions:
1. Analyze the query and determine what data is needed
2. Identify the appropriate JOIN conditions based on common naming patterns (e.g., table_id, id)
3. Generate a well-formed SQL query that answers the question
4. Use appropriate JOIN types (INNER JOIN, LEFT JOIN, etc.)
5. Include only relevant columns in the SELECT clause
6. Add appropriate WHERE clauses if filtering is needed
7. Use schema qualification (${schema}.table_name) for all table references
8. Add ORDER BY or LIMIT clauses if they make sense for the query
${conversationHistory ? '9. Consider the conversation history - the user might be building upon or modifying a previous query' : ''}

Return ONLY the SQL query, without any explanation or markdown formatting. Do not wrap it in backticks or code blocks.`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are an expert SQL query generator."
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.3,
      max_tokens: 2048,
    });

    const sql = completion.choices[0]?.message?.content?.trim() || "";

    // Clean up the SQL - remove markdown code blocks if present
    let cleanedSql = sql;
    if (cleanedSql.startsWith("```sql")) {
      cleanedSql = cleanedSql.replace(/^```sql\n/, "").replace(/\n```$/, "");
    } else if (cleanedSql.startsWith("```")) {
      cleanedSql = cleanedSql.replace(/^```\n/, "").replace(/\n```$/, "");
    }

    // Ensure the query ends with a semicolon
    if (!cleanedSql.trim().endsWith(";")) {
      cleanedSql = cleanedSql.trim() + ";";
    }

    return { sql: cleanedSql };
  },
  { name: "generate_joined_sql" }
);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { env, schema, query, tablesWithColumns, conversationContext } = body;

    if (!query || !tablesWithColumns || !Array.isArray(tablesWithColumns)) {
      return NextResponse.json(
        { error: "Query and tablesWithColumns array are required" },
        { status: 400 }
      );
    }

    const result = await generateJoinedSQLLogic({
      schema,
      query,
      tablesWithColumns,
      conversationContext,
    });

    return NextResponse.json({
      sql: result.sql,
    });
  } catch (error) {
    console.error("Error generating joined SQL:", error);
    return NextResponse.json(
      { error: "Failed to generate SQL query" },
      { status: 500 }
    );
  }
}

