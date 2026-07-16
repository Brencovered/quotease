import type { SupabaseClient } from "@supabase/supabase-js";

export type AnnotationMetaInput = {
  id: string;
  label: string;
  itemKey: string;
  type: string;
  qty: number;
  unit: string;
  note: string;
  length?: number;
  colour: string;
  frameData: string;
  calculatedLength?: number;
  roomName?: string;
};

export type AnnotationMetaPersisted = Omit<AnnotationMetaInput, "frameData"> & {
  /** Empty once persisted - the real image lives in storage now. */
  frameData: string;
  /** Storage path in the job-files bucket, or undefined if this
   *  annotation never had a photo (e.g. a freeform note). */
  storagePath?: string;
};

/**
 * Turns persisted annotation_meta (storage paths, no image data) back into
 * displayable annotations with real signed URLs, for read-only views of an
 * already-saved quote or job (the quote/job detail pages) - as opposed to
 * the live wizard, which still has the fresh in-memory frameData and
 * doesn't need this. Entries with no storagePath (a freeform note with no
 * photo) pass through with an empty frameData, which SiteAnnotationReport
 * already handles fine (it just won't render a photo for that one).
 */
export async function resolveAnnotationFrameUrls(
  supabase: SupabaseClient,
  annotations: AnnotationMetaPersisted[] | null | undefined
): Promise<(AnnotationMetaPersisted & { frameData: string })[]> {
  if (!annotations || annotations.length === 0) return [];

  // One batched createSignedUrls call for every annotation photo instead
  // of a createSignedUrl() round-trip per annotation - a job with a full
  // site survey (10-20+ photos) previously made that many separate Storage
  // API calls just to render the report.
  const withPath = annotations.filter((a) => a.storagePath);
  const paths = withPath.map((a) => a.storagePath as string);
  const urlByPath = new Map<string, string>();
  if (paths.length > 0) {
    const { data: signedBatch } = await supabase.storage.from("job-files").createSignedUrls(paths, 3600 * 24);
    for (const s of signedBatch ?? []) {
      if (s.signedUrl && s.path) urlByPath.set(s.path, s.signedUrl);
    }
  }

  return annotations.map((ann) => ({
    ...ann,
    frameData: ann.storagePath ? (urlByPath.get(ann.storagePath) ?? "") : "",
  }));
}

/**
 * Uploads each annotation's captured frame (a base64 data URL produced by
 * the camera page's canvas capture) to Supabase Storage, replacing the raw
 * image data with a storage path. Previously every save path just threw
 * the image away entirely (frameData: "") - correct data, but meant a
 * quote's site survey report only ever showed photos during the live
 * wizard session, never again after saving.
 *
 * Idempotent-ish: re-saving an already-persisted quote (frameData already
 * a storage path, not a data: URL) skips the upload and keeps the
 * existing path rather than re-uploading. Annotations with no frame at
 * all (a freeform note dropped with no photo) pass through untouched.
 */
export async function persistAnnotationFrames(
  supabase: SupabaseClient,
  businessId: string,
  annotations: AnnotationMetaInput[]
): Promise<AnnotationMetaPersisted[]> {
  return Promise.all(
    annotations.map(async (ann) => {
      if (!ann.frameData) {
        return { ...ann, frameData: "" };
      }
      if (!ann.frameData.startsWith("data:")) {
        // Already a storage path from a previous save - keep it.
        return { ...ann, frameData: "", storagePath: ann.frameData };
      }
      try {
        const res = await fetch(ann.frameData);
        const blob = await res.blob();
        const path = `${businessId}/site-annotations/${ann.id}.jpg`;
        const { error } = await supabase.storage
          .from("job-files")
          .upload(path, blob, { contentType: "image/jpeg", upsert: true });
        if (error) {
          // Don't fail the whole quote save over one photo upload -
          // the annotation's label/qty/note/room still save fine,
          // it just won't have a photo in the report.
          return { ...ann, frameData: "" };
        }
        return { ...ann, frameData: "", storagePath: path };
      } catch {
        return { ...ann, frameData: "" };
      }
    })
  );
}
