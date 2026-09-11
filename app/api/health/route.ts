/**
 * Liveness: confirms the Next.js server process is up and answering requests.
 * Does not check any external dependency — that is the job of /api/ready.
 */
export async function GET() {
  return Response.json({ status: "ok" });
}
