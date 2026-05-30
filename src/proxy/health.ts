/** Returns true when an OpenAI-compatible proxy responds on the port. */
export const probeProxyHealth = async (port: number): Promise<boolean> => {
  try {
    const res = await fetch(`http://127.0.0.1:${port}/health`);
    return res.ok;
  } catch {
    return false;
  }
};
