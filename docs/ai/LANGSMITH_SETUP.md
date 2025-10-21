# LangSmith Evaluation API Setup

This API endpoint allows you to test LangSmith evaluations in your Next.js application.

## Environment Variables

Add the following environment variables to your `.env.local` file:

```bash
# LangSmith Configuration
LANGSMITH_TRACING="true"
LANGSMITH_ENDPOINT="https://api.smith.langchain.com"
LANGSMITH_API_KEY="your-langsmith-api-key-here"

# OpenAI Configuration
OPENAI_API_KEY="your-openai-api-key-here"
```

## API Endpoints

### GET `/api/evaluate-langsmith`

Check the API status and configuration.

**Response:**
```json
{
  "status": "ready",
  "configuration": {
    "langsmithConfigured": true,
    "openaiConfigured": true,
    "langsmithEndpoint": "https://api.smith.langchain.com",
    "tracingEnabled": true
  },
  "usage": {
    "POST": {
      "description": "Run a LangSmith evaluation",
      "body": {
        "datasetName": "optional - name of the dataset",
        "experimentPrefix": "optional - prefix for the experiment",
        "examples": "optional - array of custom examples"
      }
    }
  }
}
```

### POST `/api/evaluate-langsmith`

Run a LangSmith evaluation.

**Request Body:**
```json
{
  "datasetName": "My Test Dataset",
  "experimentPrefix": "my-experiment",
  "examples": [
    {
      "inputs": { "question": "What is 2+2?" },
      "outputs": { "answer": "4" }
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "message": "Evaluation completed successfully",
  "datasetId": "dataset-id-here",
  "datasetName": "My Test Dataset",
  "results": {
    "experimentPrefix": "my-experiment",
    "message": "Check LangSmith UI for detailed results"
  }
}
```

## Testing the API

### Using cURL

1. **Check API status:**
```bash
curl http://localhost:3000/api/evaluate-langsmith
```

2. **Run an evaluation with default examples:**
```bash
curl -X POST http://localhost:3000/api/evaluate-langsmith \
  -H "Content-Type: application/json" \
  -d '{
    "datasetName": "Test Dataset",
    "experimentPrefix": "test-eval"
  }'
```

3. **Run an evaluation with custom examples:**
```bash
curl -X POST http://localhost:3000/api/evaluate-langsmith \
  -H "Content-Type: application/json" \
  -d '{
    "datasetName": "Custom Dataset",
    "experimentPrefix": "custom-eval",
    "examples": [
      {
        "inputs": { "question": "What is the capital of Japan?" },
        "outputs": { "answer": "Tokyo" }
      },
      {
        "inputs": { "question": "What is the largest ocean?" },
        "outputs": { "answer": "The Pacific Ocean" }
      }
    ]
  }'
```

### Using JavaScript/Fetch

```javascript
// Check API status
const status = await fetch('http://localhost:3000/api/evaluate-langsmith');
const statusData = await status.json();
console.log(statusData);

// Run evaluation
const response = await fetch('http://localhost:3000/api/evaluate-langsmith', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    datasetName: 'My Dataset',
    experimentPrefix: 'my-eval',
  }),
});
const result = await response.json();
console.log(result);
```

## How It Works

1. **Dataset Creation**: The API creates or reuses a dataset in LangSmith with your test examples
2. **Target Function**: Defines the application logic to evaluate (in this case, a simple Q&A with GPT-4o-mini)
3. **Evaluator**: Uses an LLM-as-judge approach to evaluate the correctness of answers
4. **Results**: Runs the evaluation and returns results that can be viewed in the LangSmith UI

## Viewing Results

After running an evaluation, visit the LangSmith UI at https://smith.langchain.com to view detailed results, including:
- Individual test case results
- Correctness scores
- Comparison across different runs
- Detailed traces of LLM calls

## Next Steps

- Customize the `target` function to test your own application logic
- Add more evaluators (e.g., for latency, cost, custom criteria)
- Create different datasets for various test scenarios
- Integrate this into your CI/CD pipeline

