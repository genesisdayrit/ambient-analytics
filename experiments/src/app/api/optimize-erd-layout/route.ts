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

interface ForeignKey {
  fromTable: string;
  fromColumn: string;
  toTable: string;
  toColumn: string;
  constraintName: string;
}

export async function POST(request: NextRequest) {
  try {
    const { tablesWithColumns, foreignKeys } = await request.json();

    if (!tablesWithColumns || !Array.isArray(tablesWithColumns)) {
      return NextResponse.json(
        { error: "Tables with columns are required" },
        { status: 400 }
      );
    }

    // Build relationship summary
    const relationshipSummary = foreignKeys.map((fk: ForeignKey) => 
      `${fk.fromTable}.${fk.fromColumn} -> ${fk.toTable}.${fk.toColumn}`
    ).join('\n');

    // Build table summary
    const tableSummary = tablesWithColumns.map((t: TableWithColumns) => {
      const columnList = t.columns.map(c => `  - ${c.name} (${c.type})`).join('\n');
      return `${t.table}:\n${columnList}`;
    }).join('\n\n');

    const prompt = `You are a database schema expert. Analyze this database schema and create an optimized ERD layout.

TABLES AND COLUMNS:
${tableSummary}

FOREIGN KEY RELATIONSHIPS:
${relationshipSummary}

Your task:
1. Classify each table as either "fact", "dimension", or "bridge":
   - Fact tables: Large transactional tables with many foreign keys, often contain metrics/measures
   - Dimension tables: Descriptive reference tables that fact tables reference, usually smaller
   - Bridge tables: Join tables that resolve many-to-many relationships

2. Create a star/snowflake schema layout with:
   - Fact tables in the center
   - Dimension tables arranged in a circle around fact tables
   - Bridge tables positioned between related tables
   - Minimize edge crossings
   - Use a canvas size of approximately 3000x3000 pixels
   - Space tables at least 600 pixels apart horizontally and 500 pixels vertically
   - Create generous spacing for a clean, readable layout

Return your response as JSON with this exact structure:
{
  "classifications": [
    {
      "tableName": "table_name",
      "type": "fact" | "dimension" | "bridge",
      "reasoning": "Brief explanation"
    }
  ],
  "positions": {
    "table_name": { "x": number, "y": number }
  }
}`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are a database schema expert. Always respond with valid JSON only, no additional text."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.3,
      response_format: { type: "json_object" }
    });

    const responseText = completion.choices[0]?.message?.content;
    
    if (!responseText) {
      throw new Error("No response from AI");
    }

    const layout = JSON.parse(responseText);

    return NextResponse.json({ layout });
  } catch (error) {
    console.error("Error optimizing ERD layout:", error);
    return NextResponse.json(
      { error: "Failed to optimize layout" },
      { status: 500 }
    );
  }
}

