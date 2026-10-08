const MODEL = "gpt-6.1-sol";

const schema = {
  type: "object",
  properties: {
    overview: { type: "string" },
    problem: { type: "string" },
    targetUsers: { type: "string" },
    valueProposition: { type: "string" },
    differentiator: { type: "string" },

    mvpFeatures: {
      type: "array",
      items: { type: "string" }
    },

    roadmap: {
      type: "array",
      items: {
        type: "object",
        properties: {
          phase: { type: "string" },
          tasks: {
            type: "array",
            items: { type: "string" }
          }
        },
        required: ["phase", "tasks"],
        additionalProperties: false
      }
    },

    readinessScore: {
      type: "integer",
      minimum: 0,
      maximum: 100
    },

    improvements: {
      type: "array",
      items: { type: "string" }
    },

    xPost: { type: "string" },
    productDescription: { type: "string" },
    pitch: { type: "string" },
    tagline: { type: "string" }
  },

  required: [
    "overview",
    "problem",
    "targetUsers",
    "valueProposition",
    "differentiator",
    "mvpFeatures",
    "roadmap",
    "readinessScore",
    "improvements",
    "xPost",
    "productDescription",
    "pitch",
    "tagline"
  ],

  additionalProperties: false
};

export default async function handler(request) {
  if (request.method !== "POST") {
    return Response.json(
      { error: "Method not allowed" },
      { status: 405 }
    );
  }

  try {
    const body = await request.json();

    const idea = body?.idea;
    const depth = body?.depth || "standard";
    const context = body?.context || "sprint";

    if (
      typeof idea !== "string" ||
      idea.trim().length < 3
    ) {
      return Response.json(
        { error: "Please provide a product idea." },
        { status: 400 }
      );
    }

    if (!process.env.OPENAI_API_KEY) {
      console.error("OPENAI_API_KEY is missing.");

      return Response.json(
        { error: "AI service is not configured." },
        { status: 500 }
      );
    }

    const systemPrompt = `
You are LaunchForge, an expert product strategist and startup launch copilot.

Turn a raw product idea into a practical, launch-ready product blueprint.

Be specific, commercially realistic, and useful.
Avoid generic startup advice.

Analyze:
- the actual problem
- target users
- value proposition
- differentiation
- MVP features
- product roadmap
- launch readiness
- improvements
- positioning
- launch messaging

Depth: ${depth}
Build context: ${context}

The roadmap must contain exactly 3 phases.

The improvements array must contain exactly 3 items.

The X post must be concise and suitable for X/Twitter.

The 30-second pitch should sound natural when spoken aloud.

Return only the requested structured data.
`;

    const userPrompt = `
Analyze this product idea:

${idea.trim()}
`;

    const response = await fetch(
      "https://api.openai.com/v1/responses",
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`
        },

        body: JSON.stringify({
          model: MODEL,

          input: [
            {
              role: "system",
              content: systemPrompt
            },
            {
              role: "user",
              content: userPrompt
            }
          ],

          text: {
            format: {
              type: "json_schema",
              name: "launchforge_analysis",
              strict: true,
              schema
            }
          }
        })
      }
    );

    const result = await response.json();

    if (!response.ok) {
      console.error("OpenAI API error:", result);

      return Response.json(
        { error: "AI analysis failed." },
        { status: response.status }
      );
    }

    if (!result.output_text) {
      console.error("Empty OpenAI response:", result);

      return Response.json(
        { error: "The AI returned an empty response." },
        { status: 500 }
      );
    }

    const analysis = JSON.parse(result.output_text);

    return Response.json({
      data: analysis
    });

  } catch (error) {
    console.error("LaunchForge API error:", error);

    return Response.json(
      { error: "Unable to generate the analysis." },
      { status: 500 }
    );
  }
}
