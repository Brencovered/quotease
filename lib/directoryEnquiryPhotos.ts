/**
 * Helpers for photos and drawings attached to a directory quote request.
 * Files live in the private job-files bucket under
 * directory-enquiries/{enquiryId}/... and are read via signed URLs.
 */

export const ENQUIRY_PHOTO_BUCKET = "job-files";
export const MAX_ENQUIRY_FILES = 6;
export const MAX_ENQUIRY_FILE_BYTES = 10 * 1024 * 1024;

export function isAllowedEnquiryFile(file: { type: string; size: number; name: string }): string | null {
  if (file.size > MAX_ENQUIRY_FILE_BYTES) {
    return `${file.name} is too large. Keep each file under 10MB.`;
  }
  const ok = file.type.startsWith("image/") || file.type === "application/pdf";
  if (!ok) {
    return `${file.name} needs to be a photo, drawing, or PDF.`;
  }
  return null;
}

export function enquiryFileStoragePath(enquiryId: string, filename: string): string {
  const safe = filename.replace(/[^a-zA-Z0-9.\-_]/g, "_");
  return `directory-enquiries/${enquiryId}/${Date.now()}-${safe}`;
}

export function fileLabelFromPath(path: string): string {
  const raw = path.split("/").pop() ?? path;
  return raw.replace(/^\d+-/, "");
}

type StorageClient = {
  storage: {
    from: (bucket: string) => {
      createSignedUrl: (
        path: string,
        expiresIn: number,
      ) => Promise<{ data: { signedUrl: string } | null; error: { message: string } | null }>;
    };
  };
};

export async function signEnquiryPhotoPaths(
  admin: StorageClient,
  paths: string[] | null | undefined,
  expiresIn = 60 * 60 * 24 * 7,
): Promise<{ path: string; url: string; name: string }[]> {
  if (!paths?.length) return [];
  const out: { path: string; url: string; name: string }[] = [];
  for (const path of paths) {
    const { data, error } = await admin.storage
      .from(ENQUIRY_PHOTO_BUCKET)
      .createSignedUrl(path, expiresIn);
    if (error || !data?.signedUrl) {
      console.error("[directory-enquiry] signed URL failed:", error?.message ?? path);
      continue;
    }
    out.push({ path, url: data.signedUrl, name: fileLabelFromPath(path) });
  }
  return out;
}
