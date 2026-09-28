interface RuntimeLike {
  runtime: {sendMessage(m: unknown): Promise<unknown>};
}

/** runtime.sendMessage from an extension page, typed to the background's reply shape. */
export async function send(m: unknown): Promise<{ok: boolean; error?: string; data?: unknown}> {
  const g = globalThis as unknown as {browser?: RuntimeLike; chrome?: RuntimeLike};
  const api = (g.browser ?? g.chrome) as RuntimeLike;
  return (await api.runtime.sendMessage(m)) as {ok: boolean; error?: string; data?: unknown};
}
