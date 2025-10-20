import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const { naturalLanguageQuery, sql, result, interpretation } = await request.json();
    
    if (!naturalLanguageQuery || !result) {
      return NextResponse.json(
        { error: "Natural language query and result are required" },
        { status: 400 }
      );
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "OpenAI API key not configured" },
        { status: 500 }
      );
    }

    // Prepare data summary for the prompt
    const dataSummary = {
      columns: result.columns,
      rowCount: result.rowCount,
      sampleRows: result.rows.slice(0, 5),
    };

    const systemPrompt = `You are an expert at creating Chart.js visualizations. Generate Chart.js configuration objects based on data and user requests.

Rules:
1. Return ONLY valid JSON - no markdown, no code blocks, no explanations
2. Choose the most appropriate chart type (bar, line, pie, doughnut, scatter, etc.)
3. Extract labels and data from the query results
4. Use appropriate colors and styling
5. Include responsive options
6. Add meaningful titles and legends
7. The configuration must be a valid Chart.js config object with "type", "data", and "options" properties`;

    const userPrompt = `Given this data query and results, generate a Chart.js configuration.

User Request: ${naturalLanguageQuery}
SQL Query: ${sql || 'N/A'}
Interpretation: ${interpretation || 'N/A'}

Data:
- Columns: ${dataSummary.columns.join(', ')}
- Row Count: ${dataSummary.rowCount}
- Sample Data: ${JSON.stringify(dataSummary.sampleRows, null, 2)}

Generate a Chart.js configuration object that best visualizes this data.
Return ONLY the JSON configuration object.`;

    // Call OpenAI API
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      temperature: 0.2,
      max_tokens: 1500,
    });

    const response = completion.choices[0]?.message?.content?.trim() || "";

    // Remove markdown code blocks if present
    const cleanedResponse = response
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();

    // Parse and validate the JSON
    let chartConfig;
    try {
      chartConfig = JSON.parse(cleanedResponse);
      
      // Basic validation
      if (!chartConfig.type || !chartConfig.data) {
        throw new Error("Invalid chart configuration structure");
      }
    } catch (parseError) {
      console.error("Failed to parse chart config:", parseError);
      console.error("Response was:", cleanedResponse);
      return NextResponse.json(
        { error: "Failed to parse chart configuration" },
        { status: 500 }
      );
    }

    return NextResponse.json({ chartConfig });
  } catch (error) {
    console.error("Error generating chart config:", error);
    return NextResponse.json(
      { error: "Failed to generate chart configuration" },
      { status: 500 }
    );
  }
}

