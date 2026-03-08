/**
 * Browser-side wrapper for server API calls.
 */

export async function callModel(modelId: string, prompt: string): Promise<string> {
  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ modelId, prompt }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'API request failed');
  }

  return data.response as string;
}

export async function callMultipleModels(
  modelIds: string[],
  prompt: string
): Promise<Map<string, string>> {
  const results = new Map<string, string>();

  const responses = await Promise.all(
    modelIds.map(async (modelId) => ({
      modelId,
      response: await callModel(modelId, prompt),
    }))
  );

  responses.forEach(({ modelId, response }) => {
    results.set(modelId, response);
  });

  return results;
}
