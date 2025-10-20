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

    // Query to get column information for the table
    const result = await client.query(`
      SELECT 
        column_name,
        data_type,
        is_nullable,
        column_default,
        character_maximum_length
      FROM information_schema.columns
      WHERE table_schema = $1 AND table_name = $2
      ORDER BY ordinal_position;
    `, [schema, table]);

    await client.end();

    const columns = result.rows.map((row) => ({
      name: row.column_name,
      type: row.data_type,
      nullable: row.is_nullable === 'YES',
      default: row.column_default,
      maxLength: row.character_maximum_length
    }));
    
    return NextResponse.json({ columns });
  } catch (error) {
    console.error("Error fetching columns:", error);
    return NextResponse.json(
      { error: "Failed to fetch columns" },
      { status: 500 }
    );
  }
}

