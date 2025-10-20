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
    const { env, schema, tablesWithColumns, schemaAnalysis } = await request.json();
    
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

    // Create the prompt for question generation
    const systemPrompt = `You are a data analyst who generates insightful questions about database schemas. Your task is to generate 5-10 interesting, diverse questions that could be answered by querying the database.

Guidelines:
1. Generate questions that vary in complexity (simple counts, aggregations, filtering, joins, trends)
2. Make questions specific and realistic based on the actual schema
3. Include questions that would be useful for business insights
4. Make questions natural and conversational
5. Return ONLY the questions as a JSON array of strings, no other text
6. Each question should be actionable and answerable with SQL

Example format:
["Question 1 here?", "Question 2 here?", ...]`;

    let contextWithAnalysis = schemaContext;
    if (schemaAnalysis) {
      contextWithAnalysis += `\n\nPrevious Schema Analysis:\n${schemaAnalysis}`;
    }

    const userPrompt = `Based on this PostgreSQL schema, generate 5-10 interesting questions that could be answered by querying this database:

${contextWithAnalysis}

Return ONLY a JSON array of question strings.`;

    // Call OpenAI API
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      temperature: 0.8,
      max_tokens: 1000,
      response_format: { type: "json_object" },
    });

    const responseText = completion.choices[0]?.message?.content?.trim() || "{}";
    
    // Parse the JSON response
    let questions: string[] = [];
    try {
      const parsed = JSON.parse(responseText);
      // Handle various possible response formats
      if (Array.isArray(parsed)) {
        questions = parsed;
      } else if (parsed.questions && Array.isArray(parsed.questions)) {
        questions = parsed.questions;
      } else if (typeof parsed === 'object') {
        // Try to extract any array from the object
        const values = Object.values(parsed);
        const arrayValue = values.find(v => Array.isArray(v));
        if (arrayValue) {
          questions = arrayValue as string[];
        }
      }
    } catch (err) {
      console.error("Failed to parse questions JSON:", err);
      console.error("Response text:", responseText);
      throw new Error("Failed to parse questions response");
    }

    // Validate and clean questions
    questions = questions
      .filter(q => typeof q === 'string' && q.trim().length > 0)
      .slice(0, 10); // Limit to 10 questions

    if (questions.length === 0) {
      throw new Error("No valid questions generated");
    }

    return NextResponse.json({ questions });
  } catch (error) {
    console.error("Error generating questions:", error);
    return NextResponse.json(
      { error: "Failed to generate questions" },
      { status: 500 }
    );
  }
}

function buildSchemaContext(schema: string, tablesWithColumns: TableWithColumns[]): string {
  let context = `Schema: ${schema}\n\n`;
  context += `Tables Overview:\n`;

  tablesWithColumns.forEach((tableWithCols) => {
    context += `\n${schema}.${tableWithCols.table}:\n`;
    
    tableWithCols.columns.forEach((col) => {
      const typeStr = col.maxLength 
        ? `${col.type}(${col.maxLength})`
        : col.type;
      const nullable = col.nullable ? 'NULL' : 'NOT NULL';
      
      context += `  - ${col.name}: ${typeStr} ${nullable}\n`;
    });
  });

  return context;
}

