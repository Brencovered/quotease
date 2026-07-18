import { createClient } from "@/lib/supabase/client";
import { safeParseApiResponse } from "@/lib/safeParseApiResponse";

// Vercel serverless functions cap the request body at ~4.5MB with no
// app-level config to raise it. Stay comfortably under that for the direct
// multipart path; anything larger goes via Supabase Storage instead (see
// below). 3.5MB leaves headroom for multipart overhead and the other form
// fields.
const DIRECT_UPLOAD_LIMIT_BYTES = 3.5 * 1024 * 1024;

export interface DrawingAnalysisResult {
  ok: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  body: any;
  parseError: string | null;
}

/**
 * Sends a file for AI drawing analysis. Files under the direct-upload
 * limit go straight to the analyze-drawing route as multipart form data,
 * same as before. Larger files (a full-resolution phone photo, a real
 * architectural PDF plan -- both routine for an actual tradie, not edge
 * cases) upload directly to Supabase Storage from the browser first,
 * bypassing the Vercel function's body limit entirely, then send just the
 * storage path to the route, which downloads the file server-side.
 */
export async function analyzeDrawingFile(
  file: File,
  trade: string,
  instructions?: string
): Promise<DrawingAnalysisResult> {
  let res: Response;

  if (file.size <= DIRECT_UPLOAD_LIMIT_BYTES) {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("trade", trade);
    if (instructions) fd.append("instructions", instructions);
    res = await fetch("/api/quotes/analyze-drawing", { method: "POST", body: fd });
  } else {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { ok: false, body: {}, parseError: "You need to be signed in to analyse a drawing." };
    }

    const ext = file.name.split(".").pop() ?? "bin";
    const storagePath = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("drawing-analysis-temp")
      .upload(storagePath, file, { upsert: false, contentType: file.type });

    if (uploadError) {
      return {
        ok: false,
        body: {},
        parseError: `Could not upload this file: ${uploadError.message}`,
      };
    }

    res = await fetch("/api/quotes/analyze-drawing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ storagePath, trade, instructions, mimeType: file.type }),
    });
  }

  return safeParseApiResponse(res);
}
