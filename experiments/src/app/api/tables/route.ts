import { NextRequest, NextResponse } from "next/server";
import { Client } from "pg";

export async function POST(request: NextRequest) {
  try {
    const { env, schema } = await request.json();
    
    if (!env || !schema) {
      return NextResponse.json(
        { error: "Environment and schema are required" },
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

    // Query to get table information for the schema
    const result = await client.query(`
      SELECT 
        table_name,
        table_type
      FROM information_schema.tables
      WHERE table_schema = $1
      ORDER BY table_name;
    `, [schema]);

    await client.end();

    const tables = result.rows.map((row) => ({
      name: row.table_name,
      type: row.table_type
    }));
    
    return NextResponse.json({ tables });
  } catch (error) {
    console.error("Error fetching tables:", error);
    return NextResponse.json(
      { error: "Failed to fetch tables" },
      { status: 500 }
    );
  }
}

