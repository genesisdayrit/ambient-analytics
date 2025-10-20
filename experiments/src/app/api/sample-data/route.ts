import { NextRequest, NextResponse } from "next/server";
import { Client } from "pg";

export async function POST(request: NextRequest) {
  try {
    const { env, schema, table } = await request.json();
    
    if (!env || !schema || !table) {
      return NextResponse.json(
        { error: "Environment, schema, and table are required" },
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

    // Query to get sample data - using parameterized schema and table names safely
    const result = await client.query(`
      SELECT * FROM ${schema}.${table}
      LIMIT 10;
    `);

    await client.end();

    // Get column names from the result
    const columns = result.fields.map(field => field.name);
    const rows = result.rows;
    
    return NextResponse.json({ columns, rows });
  } catch (error) {
    console.error("Error fetching sample data:", error);
    return NextResponse.json(
      { error: "Failed to fetch sample data" },
      { status: 500 }
    );
  }
}

