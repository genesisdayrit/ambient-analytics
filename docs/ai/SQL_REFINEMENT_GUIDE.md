# SQL Single-Pass Refinement Guide

## What's New

We've added **agentic SQL improvement** to the SQL chat interface! When the AI generates SQL that scores below 90%, you can click a button to automatically improve it.

## How It Works

### The Flow

1. **Ask a question** → AI generates SQL
2. **Execute SQL** → Get actual results from database
3. **Evaluate SQL** → AI judges quality with actual data (0-100%)
4. **If score < 90%** → "✨ Improve SQL Automatically" button appears
5. **Click button** → AI refines SQL based on:
   - Original evaluation feedback
   - Issues identified
   - Actual query results
   - Execution errors (if any)
6. **See comparison** → Original vs Improved side-by-side
7. **See new score** → Compare improvements

## Key Features

### 1. Context-Aware Refinement

The refinement API receives:
- ✅ Original question
- ✅ Original SQL query
- ✅ Evaluation feedback (score, issues, suggestions)
- ✅ **Actual execution results** (rows, columns, sample data)
- ✅ Schema context
- ✅ Execution errors (if failed)

This means the AI can see if the results actually make sense for the question!

### 2. Enhanced Evaluation

The evaluator now checks:
- ✅ Syntax correctness
- ✅ Semantic accuracy
- ✅ Schema usage
- ✅ Best practices
- ✅ **Result accuracy** (does the data make sense?)
- ✅ Execution success

**Example**: If you ask "show me messages from last week" and get all messages, the evaluator will notice the missing time filter even if the SQL is syntactically correct.

### 3. Visual Comparison

After refinement, you see:
- 📊 **Score improvement** (e.g., 70% → 95%, +25%)
- 📝 **Both SQL queries** (original and improved)
- ✅ **What improved** (list of improvements)
- 📈 **Both result sets** (compare outputs)

## Example Workflow

### Scenario: Missing Time Filter

**Question**: "Show me chat messages from the last week"

**Original SQL** (Score: 70%):
```sql
SELECT 
  DATE_TRUNC('week', created_at) as week_start,
  COUNT(*) as message_count
FROM public.chat_messages
GROUP BY DATE_TRUNC('week', created_at)
ORDER BY week_start DESC
```

**Issues Found**:
- ⚠ Does not filter for the last week
- ⚠ Lacks a WHERE clause to specify time frame

**Click "✨ Improve SQL Automatically"**

**Improved SQL** (Score: 95%):
```sql
SELECT 
  DATE_TRUNC('week', created_at) as week_start,
  COUNT(*) as message_count
FROM public.chat_messages
WHERE created_at >= NOW() - INTERVAL '1 week'
GROUP BY DATE_TRUNC('week', created_at)
ORDER BY week_start DESC
```

**Improvements**:
- ✓ Added WHERE clause to filter messages from the last week
- ✓ Uses PostgreSQL interval for precise time filtering
- ✓ Results now accurately answer the user's question

## API Endpoints

### `/api/refine-sql`

Refines SQL based on evaluation and results.

**Request**:
```json
{
  "question": "user's question",
  "originalSQL": "SELECT ...",
  "evaluation": {
    "score": 0.7,
    "issues": ["..."],
    "suggestions": "..."
  },
  "executionResult": {
    "success": true,
    "rowCount": 100,
    "columns": ["col1", "col2"],
    "sampleRows": [{...}, {...}]
  },
  "schema": "public",
  "schemaContext": [{...}]
}
```

**Response**:
```json
{
  "success": true,
  "refinedSQL": "SELECT ..."
}
```

### `/api/evaluate-sql-query` (Enhanced)

Now accepts `executionResult` to evaluate result accuracy.

**New Parameters**:
```json
{
  "executionResult": {
    "rowCount": 100,
    "columns": ["col1", "col2"],
    "rows": [{...}, {...}, {...}]
  }
}
```

## LangSmith Tracing

All refinements are fully traced:
- 🔍 See original evaluation
- 🔍 See refinement prompt
- 🔍 See refined SQL generation
- 🔍 See re-evaluation
- 🔍 Compare side-by-side in LangSmith UI

## UI Components

### Improve Button

Shows when:
- ✅ Evaluation score < 90%
- ✅ No refined version exists yet

```tsx
{message.evaluation.score < 0.9 && !message.refinedSQL && (
  <button onClick={() => refineSQL(message.id)}>
    ✨ Improve SQL Automatically
  </button>
)}
```

### Comparison View

Highlighted in purple border:
- 🟣 "Improved Version" header
- 📈 Score with improvement delta
- 💻 Refined SQL code
- ✅ Improvements list
- 📊 New results preview

## Best Practices

### When to Use Refinement

- ✅ SQL scores below 90%
- ✅ Results don't match the question
- ✅ Missing filters or conditions
- ✅ Query executes but returns unexpected data

### When NOT to Use

- ❌ SQL already scores 90%+
- ❌ Results are correct but you want different data
- ❌ You want to change the question itself

## Performance

- **Single refinement**: ~2-3 seconds
- **Includes**: Generate → Execute → Evaluate
- **Token cost**: ~500-800 tokens (GPT-4o for refinement)
- **Fully async**: Non-blocking UI

## Future Enhancements

Potential additions:
- 🔄 Multiple refinement iterations
- 🎯 User feedback on improvements
- 📚 Learn from successful refinements
- 🔀 A/B test different refinement strategies
- 💾 Save refined queries as templates

## Try It Now!

1. Navigate to: **http://localhost:3000/experiments/sql-with-evaluation**
2. Select database, schema, and table
3. Ask: "Show me messages from last week"
4. Watch it generate SQL with issues
5. Click "✨ Improve SQL Automatically"
6. See the magic! 🎯

---

**Built with**: LangSmith tracing, GPT-4o refinement, real-time evaluation

