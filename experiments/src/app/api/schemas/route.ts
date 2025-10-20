import { NextRequest, NextResponse } from "next/server";
import { Client } from "pg";

export async function POST(request: NextRequest) {
  try {
    const { env } = await request.json();
    
    if (!env) {
      return NextResponse.json(
        { error: "Environment is required" },
        { status: 400 }
      );
    }

    // For now, we'll use a demo postgres URL
    // In production, you'd map the env to actual connection strings
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

    // Query to get all schemas excluding system schemas
    const result = await client.query(`
      SELECT schema_name 
      FROM information_schema.schemata 
      WHERE schema_name NOT IN ('information_schema', 'pg_catalog', 'pg_toast')
      AND schema_name NOT LIKE 'pg_%'
      ORDER BY schema_name;
    `);

    await client.end();

    const schemas = result.rows.map((row) => row.schema_name);
    
    return NextResponse.json({ schemas });
  } catch (error) {
    console.error("Error fetching schemas:", error);
    return NextResponse.json(
      { error: "Failed to fetch schemas" },
      { status: 500 }
    );
  }
}

