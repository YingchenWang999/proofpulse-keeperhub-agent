const STATUS = Object.freeze({ HEALTHY: 1, DEGRADED: 2, CRITICAL: 3 });

function clampConfidence(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) throw new Error("Ollama confidenceBps must be a finite number");
  return Math.max(0, Math.min(10_000, Math.round(numeric)));
}

export function evaluateWithRules(snapshot, config) {
  const reasons = [];
  let status = STATUS.HEALTHY;

  if (snapshot.blockLagSeconds > config.maxBlockLagSeconds) {
    status = snapshot.blockLagSeconds > config.maxBlockLagSeconds * 3 ? STATUS.CRITICAL : STATUS.DEGRADED;
    reasons.push(`latest block is ${snapshot.blockLagSeconds}s old`);
  }
  if (snapshot.baseFeeGwei > config.maxBaseFeeGwei) {
    status = Math.max(status, STATUS.DEGRADED);
    reasons.push(`base fee is ${snapshot.baseFeeGwei.toFixed(3)} gwei`);
  }
  if (reasons.length === 0) reasons.push("block freshness and base fee are within policy limits");

  return {
    status,
    confidenceBps: status === STATUS.HEALTHY ? 9_500 : 9_000,
    summary: reasons.join("; "),
    evaluator: "rules-v1",
  };
}

function parseOllamaDecision(content) {
  const parsed = JSON.parse(content);
  const statusName = String(parsed.status ?? "").toUpperCase();
  if (!Object.hasOwn(STATUS, statusName)) throw new Error("Ollama returned an unsupported status");
  if (typeof parsed.summary !== "string" || parsed.summary.trim() === "") {
    throw new Error("Ollama returned no summary");
  }
  return {
    status: STATUS[statusName],
    confidenceBps: clampConfidence(parsed.confidenceBps),
    summary: parsed.summary.trim(),
    evaluator: "ollama",
  };
}

export async function evaluateWithOllama(snapshot, config, fetchImpl = fetch) {
  let response;
  try {
    response = await fetchImpl(`${config.ollamaUrl.replace(/\/$/, "")}/api/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model: config.ollamaModel,
        stream: false,
        format: "json",
        messages: [
          {
            role: "system",
            content:
              "Classify EVM chain health. Return JSON only: status HEALTHY, DEGRADED, or CRITICAL; confidenceBps 0-10000; and a concise summary. Never recommend or request a transfer, approval, trade, deposit, or token purchase.",
          },
          { role: "user", content: JSON.stringify(snapshot) },
        ],
      }),
      signal: AbortSignal.timeout(config.ollamaTimeoutMs),
    });
  } catch (error) {
    throw new Error(`Ollama request failed: ${error.message}`, { cause: error });
  }
  if (!response.ok) throw new Error(`Ollama failed with HTTP ${response.status}`);
  const body = await response.json();
  return parseOllamaDecision(body.message?.content ?? "");
}

export async function evaluateSnapshot(snapshot, config, fetchImpl = fetch) {
  const rulesDecision = evaluateWithRules(snapshot, config);
  if (config.evaluatorMode === "ollama") {
    const aiDecision = await evaluateWithOllama(snapshot, config, fetchImpl);
    if (aiDecision.status < rulesDecision.status) {
      return {
        status: rulesDecision.status,
        confidenceBps: Math.min(aiDecision.confidenceBps, rulesDecision.confidenceBps),
        summary: `deterministic guardrail: ${rulesDecision.summary}; AI: ${aiDecision.summary}`,
        evaluator: "ollama+rules-v1",
      };
    }
    return { ...aiDecision, evaluator: "ollama+rules-v1" };
  }
  return rulesDecision;
}

export { STATUS, parseOllamaDecision };
