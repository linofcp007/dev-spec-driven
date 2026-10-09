"use strict";
// Tracks — 1.25.1 readers review: the classifier's AI product names, its everyday-word cues, "no more X" / "without X … is incomplete", the small-change size.
// (04-tracks.js and 04-tracks-builtin.js hold the area's earlier tests; this file the fixes of the 1.25.1 readers review.)

exports.run = async ({ ok, S }) => {
  const js = JSON.stringify;
  const on = (t, tr, lang) => S.classify(t, lang ? { lang } : {}).tracks.includes(tr);
  const poss = (t, tr) => (S.classify(t, {}).possible || []).some((p) => p.track === tr);

  { // 1.25.1 (2): the well-known AI products, frameworks and vector stores, "-compatible", training / predicting with a model — +ai
    const yes = ["Add a ChatGPT plugin", "Run Ollama locally to answer questions", "Use Cohere rerank", "Generate images with Stable Diffusion",
      "Generate images with DALL-E", "Index docs with LlamaIndex", "Store vectors in pgvector", "Use the OpenAI-compatible endpoint",
      "Train a classifier to tag tickets", "Predict churn for each customer", "Build the agent with LangChain", "Use a Hugging Face model for tagging",
      "Call Amazon Bedrock for summaries", "Treinar um modelo para classificar tickets", "O modelo é treinado todas as noites para classificar tickets",
      "Entrenar un modelo para clasificar tickets", "Retrain the recommendation model nightly", "Detect anomalies in sensor readings with a trained model",
      "Prever o churn de cada cliente", "Predecir el churn de cada cliente"];
    const miss = yes.filter((t) => !on(t, "ai"));
    ok(miss.length === 0, "1.25.1 (2): +ai for ChatGPT, Ollama, Cohere, Stable Diffusion, DALL-E, LlamaIndex, pgvector, an OpenAI-compatible endpoint, training a classifier / model (EN / PT / ES), predicting churn, LangChain, Hugging Face, Amazon Bedrock (misses: " + js(miss) + ")");
    // … and never for the everyday senses of the new words: training people, a model answer, a lower-case cohere
    const no = ["Train the support team on the new process", "Train new hires with a model answer sheet", "The modules cohere around the order domain"];
    const wrong = no.filter((t) => on(t, "ai"));
    ok(wrong.length === 0, "1.25.1 (2): no +ai for training people, a model answer sheet four words away, a lower-case 'cohere' (got " + js(wrong) + ")");
  }

  { // 1.25.1 (3): everyday words no longer switch tracks on — case-sensitive product names / RAG, cues for credits, charge, session, cron, tokens
    const offAi = ["Show a rag rug category", "Show the claude monet paintings in the gallery", "Show the Claude Monet paintings in the gallery",
      "Show the mistral wind forecast", "Show the Mistral wind forecast", "Add a gemini zodiac page", "Add a Gemini zodiac page",
      "Write a copilot seat guide for pilots", "Write a Copilot seat guide for pilots", "The tool use log for the workshop machines"];
    const offTdd = ["Add photo credits under each gallery image", "Show who is in charge of each project", "Add a notes field to each therapy session",
      "Show the battery charge level on the dashboard", "Show the film credits roll", "Agendar uma sessão de terapia por semana"];
    const bad = [...offAi.filter((t) => on(t, "ai") || poss(t, "ai")), ...offTdd.filter((t) => on(t, "tdd")),
      ...(on("Add a cron expression helper", "saas") ? ["cron expression helper"] : []),
      ...(poss("Add a password reset flow with email tokens", "ai") ? ["email tokens"] : [])];
    ok(bad.length === 0, "1.25.1 (3): a rag rug, Claude Monet, the Mistral wind, a Gemini zodiac page, a copilot's seat, a workshop's tool use log are no +ai; photo / film credits, 'in charge of', a battery charge, a therapy session are no +tdd; a cron expression helper is no +saas; email tokens no 'possible +ai' (got " + js(bad) + ")");
    // … while the real senses keep their tracks
    const keep = [["Summarize tickets with Claude", "ai"], ["Use Gemini 1.5 to translate product descriptions", "ai"], ["Call Mistral Large for classification", "ai"],
      ["Add a GitHub Copilot extension", "ai"], ["Build a RAG pipeline over the docs", "ai"], ["Add tool use to the support agent", "ai"], ["Claude3 drafts the replies", "ai"],
      ["Charge the customer's card when the order ships", "tdd"], ["Add a late-payment charge to overdue invoices", "tdd"], ["Store the credit card fingerprint", "tdd"],
      ["Refresh the session token every 15 minutes", "tdd"], ["Run the cleanup on a cron schedule", "saas"], ["Add a cron job to purge expired sessions", "saas"],
      ["Track LLM tokens per request", "ai"]];
    const lost = keep.filter(([t, tr]) => !on(t, tr));
    ok(lost.length === 0, "1.25.1 (3): Claude / Gemini / Mistral / Copilot / RAG (and Claude3) written as products, an agent's tool use, a card charge, a credit card, a session token, a cron job, LLM tokens keep their tracks (lost: " + js(lost) + ")");
  }

  { // 1.25.1 (13): "no more X" is a replacement, "without X … is incomplete" a need — the track stays; a plain exclusion still excludes
    const keep = [["Without an LLM summary the ticket view is incomplete", "ai"], ["Without an LLM the report would be useless", "ai"],
      ["Sem um resumo por LLM a vista do ticket fica incompleta", "ai"], ["Sin un resumen con LLM la vista del ticket queda incompleta", "ai"],
      ["Without an LLM summary the ticket view is not usable", "ai"], ["No more manual invoices: generate them automatically", "tdd"],
      ["No más facturas manuales: generarlas automáticamente", "tdd"]];
    const lost = keep.filter(([t, tr]) => !on(t, tr));
    const excl = ["Build the summary without an LLM", "Without an LLM, show the raw text", "We do not want an LLM here", "No LLM is used; the summary is a template"]
      .filter((t) => on(t, "ai"));
    const neg = S.classify("Without Kafka the pipeline is simpler", {});
    ok(lost.length === 0 && excl.length === 0 && !neg.tracks.includes("dist") && neg.negated.dist.includes("kafka"),
      "1.25.1 (13): 'no more X' (EN / ES) and 'without X … is incomplete / useless / not usable' (EN / PT / ES) keep the track; 'without an LLM', 'do not want', 'No LLM is used', 'Without Kafka the pipeline is simpler' still exclude (lost: " +
      js(lost) + ", wrongly on: " + js(excl) + ")");
  }

  { // 1.25.1 (17): one small behaviour change suggests xs (small-change) — EN / PT / ES; the existing reasons are unchanged
    const cases = [["Return a clearer error message when the orders route gets an empty customer id", "xs", "small-change"],
      ["Increase the upload limit to 50 MB", "xs", "small-change"], ["Reject an empty customer id with a 400", "xs", "small-change"],
      ["Mostrar uma mensagem de erro mais clara quando o id do cliente vem vazio", "xs", "small-change"],
      ["Mostrar un mensaje de error más claro cuando el id del cliente llega vacío", "xs", "small-change"],
      ["fix a typo in the footer", "xs", "trivial-change"], ["add a CSV export button to the orders page", "s", "single-unit"],
      ["Stripe checkout for subscriptions", "m", "default"], ["a public REST API v2 with rate limits and SLO alerts", "l", "several-tracks"]];
    const got = cases.map(([t]) => { const r = S.classify(t, {}); return [r.suggestedSize, r.sizeReason, r.sizeNote]; });
    ok(got.every((g, i) => g[0] === cases[i][1] && g[1] === cases[i][2]) && /^Suggested size xs — one small behaviour change/.test(got[0][2]) &&
      /^Tamanho sugerido xs/.test(got[3][2]) && /^Tamaño sugerido xs/.test(got[4][2]),
      "1.25.1 (17): a clearer error message, a limit raised, one empty input rejected → xs (small-change, a localized note — EN / PT / ES); a typo, a button, a feature, three tracks keep xs / s / m / l (got " +
      js(got.map((g) => g.slice(0, 2))) + ")");
  }
};
