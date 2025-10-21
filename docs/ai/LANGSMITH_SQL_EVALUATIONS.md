# LangSmith SQL Evaluation System

## What We Built

A comprehensive evaluation and observability system for your SQL generation pipeline using LangSmith. This helps you:

1. **Monitor production SQL generation** with full tracing
2. **Evaluate SQL quality** automatically with LLM-as-judge
3. **Improve prompts iteratively** by comparing evaluation scores
4. **Debug issues** by viewing full traces in LangSmith UI

## Components

### 1. Tracing on SQL Generation API
**File:** `/src/app/api/generate-sql/route.ts`

Your existing SQL generation endpoint now has **full observability**:
- Every LLM call is traced
- Input prompts and output SQL are logged
- Execution time and token usage tracked
- Viewable in LangSmith UI in real-time

### 2. SQL-Specific Evaluation API
**File:** `/src/app/api/evaluate-sql-generation/route.ts`

Runs automated evaluations on SQL generation with:
- **5 curated test cases** covering common SQL patterns:
  - Date filtering (last 30 days)
  - Aggregations with JOINs (orders per customer)
  - Complex multi-table queries (top products by revenue)
  - LEFT JOIN patterns (products never ordered)
  - Time-series analysis (monthly averages)

- **Custom SQL Evaluator** that checks:
  - ✅ Syntax correctness (valid PostgreSQL)
  - ✅ Semantic accuracy (does it answer the question?)
  - ✅ Schema usage (correct tables, columns, joins)
  - ✅ Best practices (qualified names, proper JOINs)
  - ✅ Completeness (fully addresses the query)

### 3. Interactive Testing UI
**File:** `/src/app/experiments/langsmith-evaluations/page.tsx`

A frontend to test everything with 3 workflows:

#### Workflow 1: Basic Evaluation Test
- Validates LangSmith integration
- Runs simple Q&A evaluation
- Good for verifying setup

#### Workflow 2: Test SQL Generation with Tracing
- Generates a real SQL query
- Shows full trace in LangSmith
- See prompt engineering in action

#### Workflow 3: SQL Generation Evaluation
- Runs all 5 SQL test cases
- Evaluates each generated query
- Produces quality scores (0.0 to 1.0)
- Identifies issues and improvements

## How to Use

### Step 1: Access the Experiment
1. Start your dev server: `npm run dev`
2. Navigate to http://localhost:3000/experiments
3. Click on **"langsmith evaluations"**

### Step 2: Check Configuration
Click **"Check Configuration"** to verify:
- ✅ LangSmith API key is set
- ✅ OpenAI API key is set
- ✅ Tracing is enabled

### Step 3: Run Tests

**Option A: Test Basic Evaluation**
- Click "Run Basic Evaluation"
- Validates the integration works
- View results in LangSmith UI

**Option B: Test Traced SQL Generation**
- Click "Test SQL Generation"
- Generates a sample SQL query
- Trace appears in LangSmith UI immediately
- Shows: prompt → LLM call → SQL output

**Option C: Run Full SQL Evaluation**
- Enter dataset name and experiment prefix
- Click "Run SQL Evaluation"
- Evaluates 5 SQL test cases
- Get quality scores and feedback

### Step 4: View Results in LangSmith

1. Click "View in LangSmith UI" or go to https://smith.langchain.com
2. Navigate to your project (default project or specified)
3. See:
   - **Traces:** Full execution flow of each SQL generation
   - **Experiments:** Comparison of evaluation runs
   - **Datasets:** Your test cases
   - **Feedback:** Evaluation scores and reasoning

## Value Propositions

### 🔍 Debugging
When SQL generation fails or produces incorrect queries:
- View the exact prompt sent to the LLM
- See the LLM's raw response
- Identify where the logic breaks
- Compare working vs broken examples

### 📊 Quality Metrics
Track SQL generation quality over time:
- Baseline score with current prompts
- A/B test different prompt variations
- Measure improvement after changes
- Identify edge cases that need work

### 🚀 Continuous Improvement
Iterative prompt engineering workflow:
1. Run evaluation → get baseline score (e.g., 0.75)
2. Modify prompt in `/api/generate-sql/route.ts`
3. Run evaluation again → get new score (e.g., 0.82)
4. Compare experiments in LangSmith
5. Keep the better version

### 🏭 Production Monitoring
All production SQL generation is traced:
- Monitor real user queries
- Identify patterns in failures
- Create test cases from production data
- Catch issues before users report them

## Example Workflow: Improving SQL Generation

### Current State
Run evaluation, get results like:
- Test 1: ✅ 0.95 (excellent)
- Test 2: ⚠️ 0.65 (needs improvement)
- Test 3: ✅ 0.90 (good)
- Test 4: ❌ 0.40 (failing)
- Test 5: ✅ 0.85 (good)

### Analyze Failing Test
1. Open LangSmith UI
2. Find Test 4 trace
3. See the evaluator's reasoning:
   - "Query used INNER JOIN instead of LEFT JOIN"
   - "Missing schema qualification on one table"
   - "Incorrect date function used"

### Fix the Prompt
Update the system prompt in `generate-sql/route.ts`:
```typescript
const systemPrompt = `...
8. When finding items that DON'T exist, use LEFT JOIN with IS NULL pattern
9. For date ranges, prefer INTERVAL syntax over date arithmetic
...`;
```

### Re-evaluate
Run evaluation again with new experiment prefix:
- Test 4: ✅ 0.90 (fixed!)

### Compare in LangSmith
View side-by-side comparison:
- Experiment "sql-eval-v1" vs "sql-eval-v2"
- See which test cases improved
- Identify any regressions
- Keep the better version

## Adding More Test Cases

Edit `/api/evaluate-sql-generation/route.ts` and add to the `examples` array:

```typescript
{
  inputs: { 
    question: "Your natural language query here",
    schema: "public",
    tables: JSON.stringify([/* table definitions */])
  },
  outputs: { 
    sql: "Expected SQL query here",
    explanation: "Why this SQL is correct"
  },
}
```

## Environment Variables

Required in `.env.local`:
```bash
LANGSMITH_TRACING="true"
LANGSMITH_ENDPOINT="https://api.smith.langchain.com"
LANGSMITH_API_KEY="lsv2_pt_..."
OPENAI_API_KEY="sk-..."
```

## Next Steps

1. **Add more test cases** - Cover your specific SQL patterns
2. **Integrate into CI/CD** - Run evaluations on every deployment
3. **Create custom evaluators** - Beyond just correctness (performance, security)
4. **Monitor production** - Set up alerts for low-scoring queries
5. **Build feedback loops** - Let users report bad SQL, add to test suite

## Resources

- [LangSmith UI](https://smith.langchain.com)
- [LangSmith Docs](https://docs.smith.langchain.com)
- [OpenEvals Library](https://github.com/langchain-ai/openevals)
- Your experiment page: http://localhost:3000/experiments/langsmith-evaluations

