import { NextRequest, NextResponse } from "next/server";
import { Client } from "pg";

export async function POST(request: NextRequest) {
  try {
    const { env, sql } = await request.json();
    
    if (!env || !sql) {
      return NextResponse.json(
        { error: "Environment and SQL are required" },
        { status: 400 }
      );
    }

    const connectionString = process.env.DEMO_POSTGRES_DATABASE_URL;
    
    if (!connectionString) {
      return NextResponse.json(
        { error: "Database connection string not configured" },
        { status: 500 }
      );
    }

    const client = new Client({ 
      connectionString,
      ssl: {
        rejectUnauthorized: false
      }
    });
    
    await client.connect();

    let executionResult;
    let executionError = null;

    try {
      const result = await client.query(sql);
      
      // Get column names from the result
      const columns = result.fields.map(field => field.name);
      const rows = result.rows;
      
      executionResult = {
        columns,
        rows,
        rowCount: result.rowCount || 0
      };
    } catch (execError: any) {
      console.error("Error executing SQL:", execError);
      executionError = execError.message || "Failed to execute SQL";
    } finally {
      await client.end();
    }

    return NextResponse.json({ 
      result: executionResult,
      error: executionError
    });
  } catch (error) {
    console.error("Error executing SQL:", error);
    return NextResponse.json(
      { error: "Failed to execute SQL" },
      { status: 500 }
    );
  }
}

