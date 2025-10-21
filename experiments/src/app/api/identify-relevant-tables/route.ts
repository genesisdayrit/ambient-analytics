import { NextResponse } from "next/server";
import OpenAI from "openai";
import { wrapOpenAI } from "langsmith/wrappers";
import { traceable } from "langsmith/traceable";

const openai = wrapOpenAI(new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
}));

const identifyTablesLogic = traceable(
  async (params: {
    query: string;
    tables: string[];
    conversationContext?: any[];
  }) => {
    const { query, tables, conversationContext } = params;

    // Build conversation history if provided
    let conversationHistory = '';
    if (conversationContext && conversationContext.length > 0) {
      conversationHistory = '\n\nConversation History:\n' + conversationContext.map((msg: any, idx: number) => {
        let text = `${idx + 1}. ${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`;
        if (msg.relevantTables && msg.relevantTables.length > 0) {
          text += `\n   Identified tables: ${msg.relevantTables.join(', ')}`;
        }
        if (msg.sql) text += `\n   SQL: ${msg.sql}`;
        if (msg.result) text += `\n   Result: ${msg.result.rowCount} rows`;
        return text;
      }).join('\n') + '\n';
    }

    const prompt = `You are a database expert. Given a user's natural language query and a list of available tables, identify which tables are likely relevant to answering the query.
${conversationHistory}
Current User Query: "${query}"

Available Tables:
${tables.map((table, idx) => `${idx + 1}. ${table}`).join('\n')}

Analyze the query and determine which tables would be needed to answer it. Consider:
- Table names and what they likely contain
- Common database naming conventions (e.g., "orders", "customers", "products")
- Relationships that might exist between tables
- What data would be needed to answer the query
${conversationHistory ? '- Previous context from the conversation (the user might be referring to tables or concepts from earlier messages)' : ''}

Return ONLY a JSON array of table names that are relevant. Do not include any explanation or additional text.

Example format:
["table1", "table2", "table3"]`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.3,
      max_tokens: 1024,
    });

    const responseText = completion.choices[0]?.message?.content?.trim() || "";

    // Parse the JSON response
    let relevantTables: string[] = [];
    try {
      // Try to extract JSON from the response
      const jsonMatch = responseText.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        relevantTables = JSON.parse(jsonMatch[0]);
      } else {
        // Fallback: if no JSON found, return empty array
        relevantTables = [];
      }
    } catch (parseError) {
      console.error("Failed to parse LLM response:", parseError);
      console.error("Response text:", responseText);
      relevantTables = [];
    }

    // Validate that all returned tables exist in the provided list
    relevantTables = relevantTables.filter(table => tables.includes(table));

    return { relevantTables };
  },
  { name: "identify_relevant_tables" }
);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { query, tables, conversationContext } = body;

    if (!query || !tables || !Array.isArray(tables)) {
      return NextResponse.json(
        { error: "Query and tables array are required" },
        { status: 400 }
      );
    }

    const result = await identifyTablesLogic({
      query,
      tables,
      conversationContext,
    });

    return NextResponse.json({
      relevantTables: result.relevantTables,
    });
  } catch (error) {
    console.error("Error identifying relevant tables:", error);
    return NextResponse.json(
      { error: "Failed to identify relevant tables" },
      { status: 500 }
    );
  }
}

