import { NextResponse } from "next/server";
import { Client } from "langsmith";
import { createLLMAsJudge, CORRECTNESS_PROMPT } from "openevals";
import { wrapOpenAI } from "langsmith/wrappers";
import OpenAI from "openai";
import { evaluate } from "langsmith/evaluation";

// POST endpoint to run LangSmith evaluation
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { 
      datasetName = "Sample dataset",
      experimentPrefix = "langsmith-eval-test",
      examples: customExamples 
    } = body;

    // Initialize LangSmith client
    const client = new Client({
      apiKey: process.env.LANGSMITH_API_KEY,
    });

    // Check if dataset already exists, if not create it
    let dataset;
    try {
      const datasets = await client.listDatasets({ datasetName });
      const existingDatasets = [];
      for await (const ds of datasets) {
        existingDatasets.push(ds);
      }
      
      if (existingDatasets.length > 0) {
        dataset = existingDatasets[0];
        console.log(`Using existing dataset: ${dataset.id}`);
      } else {
        throw new Error("Dataset not found");
      }
    } catch (error) {
      // Create new dataset
      dataset = await client.createDataset(datasetName, {
        description: "A sample dataset for LangSmith evaluation testing.",
      });
      console.log(`Created new dataset: ${dataset.id}`);

      // Create default examples if no custom examples provided
      const examples = customExamples || [
        {
          inputs: { question: "Which country is Mount Kilimanjaro located in?" },
          outputs: { answer: "Mount Kilimanjaro is located in Tanzania." },
        },
        {
          inputs: { question: "What is Earth's lowest point?" },
          outputs: { answer: "Earth's lowest point is The Dead Sea." },
        },
        {
          inputs: { question: "What is the capital of France?" },
          outputs: { answer: "The capital of France is Paris." },
        },
      ];

      // Add examples to the dataset
      await client.createExamples({
        inputs: examples.map((ex: { inputs: Record<string, unknown> }) => ex.inputs),
        outputs: examples.map((ex: { outputs: Record<string, unknown> }) => ex.outputs),
        datasetId: dataset.id,
      });
      console.log(`Added ${examples.length} examples to dataset`);
    }

    // Wrap the OpenAI client for LangSmith tracing
    const openai = wrapOpenAI(new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    }));

    // Define the target function - the application logic to evaluate
    async function target(inputs: {
      question: string;
    }): Promise<{ answer: string }> {
      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "Answer the following question accurately" },
          { role: "user", content: inputs.question },
        ],
      });
      return { answer: response.choices[0].message.content?.trim() || "" };
    }

    // Define the correctness evaluator using LLM as a judge
    const correctnessEvaluator = async (params: {
      inputs: Record<string, unknown>;
      outputs: Record<string, unknown>;
      referenceOutputs?: Record<string, unknown>;
    }) => {
      const evaluator = createLLMAsJudge({
        prompt: CORRECTNESS_PROMPT,
        model: "gpt-4o-mini",
        feedbackKey: "correctness",
      });
      const evaluatorResult = await evaluator({
        inputs: params.inputs,
        outputs: params.outputs,
        referenceOutputs: params.referenceOutputs,
      });
      return evaluatorResult;
    };

    // Run the evaluation
    const results = await evaluate(target, {
      data: datasetName,
      evaluators: [correctnessEvaluator],
      experimentPrefix,
      maxConcurrency: 2,
    });

    return NextResponse.json({
      success: true,
      message: "Evaluation completed successfully",
      datasetId: dataset.id,
      datasetName,
      results: {
        experimentPrefix,
        // The evaluate function returns results that can be viewed in LangSmith UI
        message: "Check LangSmith UI for detailed results",
      },
    });
  } catch (error) {
    console.error("Error running evaluation:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error occurred",
      },
      { status: 500 }
    );
  }
}

// GET endpoint to check API status and configuration
export async function GET() {
  const hasLangSmithKey = !!process.env.LANGSMITH_API_KEY;
  const hasOpenAIKey = !!process.env.OPENAI_API_KEY;
  
  return NextResponse.json({
    status: "ready",
    configuration: {
      langsmithConfigured: hasLangSmithKey,
      openaiConfigured: hasOpenAIKey,
      langsmithEndpoint: process.env.LANGSMITH_ENDPOINT || "https://api.smith.langchain.com",
      tracingEnabled: process.env.LANGSMITH_TRACING === "true",
    },
    usage: {
      POST: {
        description: "Run a LangSmith evaluation",
        body: {
          datasetName: "optional - name of the dataset (default: 'Sample dataset')",
          experimentPrefix: "optional - prefix for the experiment (default: 'langsmith-eval-test')",
          examples: "optional - array of custom examples with inputs/outputs",
        },
      },
    },
  });
}

