import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const { naturalLanguageQuery, sql, result } = await request.json();
    
    if (!naturalLanguageQuery || !sql || !result) {
      return NextResponse.json(
        { error: "Natural language query, SQL, and result are required" },
        { status: 400 }
      );
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "OpenAI API key not configured" },
        { status: 500 }
      );
    }

    const interpretationPrompt = `You are a helpful data analyst assistant. Based on the following query and results, provide a clear, concise interpretation and summary.

User's Question: "${naturalLanguageQuery}"

SQL Query Executed:
${sql}

Results (${result.rowCount} rows):
${JSON.stringify(result.rows.slice(0, 10), null, 2)}
${result.rowCount > 10 ? `\n(Showing first 10 of ${result.rowCount} total rows)` : ''}

Provide a natural language summary and interpretation of these results. Focus on:
1. Directly answering the user's question
2. Key insights from the data
3. Any notable patterns or trends
4. Keep it concise and conversational

Response:`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: "You are a helpful data analyst assistant that interprets query results in clear, natural language." },
        { role: "user", content: interpretationPrompt }
      ],
      temperature: 0.7,
      max_tokens: 500,
    });

    const interpretation = completion.choices[0]?.message?.content?.trim() || "";

    return NextResponse.json({ interpretation });
  } catch (error) {
    console.error("Error generating interpretation:", error);
    return NextResponse.json(
      { error: "Failed to generate interpretation" },
      { status: 500 }
    );
  }
}

