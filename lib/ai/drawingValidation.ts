/**
 * drawingValidation.ts
 *
 * Image quality validation module for the SwiftScope AI drawing analysis pipeline.
 *
 * Validates uploaded building drawings/plans (images and PDFs) before they are
 * sent to Claude AI for symbol detection and quantity extraction. Provides
 * actionable feedback to tradies so they can re-upload higher-quality files
 * when needed.
 *
 * @module drawingValidation
 */

import sharp from "sharp";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Quality score tiers for an uploaded drawing. */
export type ImageQualityScore = "high" | "medium" | "low" | "rejected";

/** Result of validating a single drawing file. */
export interface ValidationResult {
  /** Whether the file passes the minimum bar for AI analysis. */
  valid: boolean;
  /** Quality tier — used to decide whether to proceed or ask for a re-upload. */
  score: ImageQualityScore;
  /** Image dimensions (not available for PDFs). */
  dimensions?: { width: number; height: number };
  /** File size in bytes. */
  fileSize: number;
  /** MIME type of the uploaded file. */
  fileType: string;
  /** Number of pages (PDF only). */
  pageCount?: number;
  /** Human-readable issues detected during validation. */
  issues: string[];
  /** Actionable advice shown to the tradie in the UI. */
  guidance: string;
  /** Rough Claude token estimate (cost-awareness). */
  estimatedTokenCount: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Maximum allowed file size in bytes (10 MB). */
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

/** MIME types accepted by the drawing analysis pipeline. */
const SUPPORTED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "application/pdf",
];

/** Token cost constants. */
const TOKENS_PER_1000PX2 = 150;
const TOKENS_PER_PDF_PAGE = 2000;
const MAX_TOKEN_DISPLAY = 500_000;

/** Dimension thresholds for scoring (shortest side in px). */
const REJECTED_THRESHOLD = 400;
const LOW_THRESHOLD = 800;
const MEDIUM_THRESHOLD = 1600;

/** PDF page-count thresholds. */
const PDF_PAGE_COUNT_MEDIUM = 20;
const PDF_PAGE_COUNT_LOW = 50;

/** Blur-detection entropy threshold (empirically tuned). */
const BLUR_ENTROPY_THRESHOLD = 3.0;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Validates a drawing file (image or PDF) for AI analysis quality.
 *
 * Checks file type, size, resolution, blur, page count (PDF), and estimates
 * token cost. Returns a {@link ValidationResult} that includes human-readable
 * issues and actionable guidance for the uploader.
 *
 * **Scoring rules (images):**
 * - shortest side < 400 px  → `rejected`
 * - shortest side 400–799 px → `low`
 * - shortest side 800–1599 px → `medium`
 * - shortest side ≥ 1600 px → `high`
 *
 * **Scoring rules (PDFs):**
 * - ≤ 20 pages → `high`
 * - 21–50 pages → `medium`
 * - > 50 pages → `low`
 *
 * @param buffer   Raw file bytes from `file.arrayBuffer()`.
 * @param mimeType MIME type reported by the upload (e.g. `image/jpeg`).
 * @returns Promise resolving to a {@link ValidationResult}.
 */
export async function validateDrawing(
  buffer: Buffer,
  mimeType: string
): Promise<ValidationResult> {
  const issues: string[] = [];
  let score: ImageQualityScore = "high";
  let dimensions: { width: number; height: number } | undefined;
  let pageCount: number | undefined;

  // --- 1. File type check --------------------------------------------------
  if (!SUPPORTED_TYPES.includes(mimeType)) {
    return buildResult({
      valid: false,
      score: "rejected",
      fileSize: buffer.length,
      fileType: mimeType,
      issues: [`Unsupported file type "${mimeType}".`],
      guidance:
        "Please upload a supported file type: JPEG, PNG, WebP, GIF, or PDF. " +
        "Other formats (e.g. BMP, TIFF, HEIC) cannot be processed by the AI.",
      estimatedTokenCount: 0,
    });
  }

  // --- 2. File size check --------------------------------------------------
  if (buffer.length > MAX_FILE_SIZE_BYTES) {
    return buildResult({
      valid: false,
      score: "rejected",
      fileSize: buffer.length,
      fileType: mimeType,
      issues: [
        `File size ${formatBytes(buffer.length)} exceeds the ` +
          `${formatBytes(MAX_FILE_SIZE_BYTES)} limit.`,
      ],
      guidance:
        "This file is too large. Try compressing the image (e.g. use an " +
        "online JPEG compressor) or split a large PDF into individual sheets.",
      estimatedTokenCount: 0,
    });
  }

  // --- 3. Image-specific validation ----------------------------------------
  const isImage = mimeType.startsWith("image/");
  const isPdf = mimeType === "application/pdf";

  if (isImage) {
    try {
      const metadata = await sharp(buffer).metadata();
      const width = metadata.width ?? 0;
      const height = metadata.height ?? 0;
      dimensions = { width, height };

      if (width === 0 || height === 0) {
        issues.push("Could not determine image dimensions.");
        score = "rejected";
      } else {
        const shortestSide = Math.min(width, height);

        if (shortestSide < REJECTED_THRESHOLD) {
          score = "rejected";
          issues.push(
            `Resolution is very low (${width}x${height} px). Shortest side is ${shortestSide}px.`
          );
        } else if (shortestSide < LOW_THRESHOLD) {
          score = "low";
          issues.push(
            `Resolution is low (${width}x${height} px). Shortest side is ${shortestSide}px.`
          );
        } else if (shortestSide < MEDIUM_THRESHOLD) {
          score = "medium";
        }
      }

      // Blur detection
      try {
        const stats = await sharp(buffer).stats();
        const imageSharpness = stats.sharpness;
        const imageEntropy = stats.entropy;

        if (imageSharpness < 0.5) {
          issues.push(
            `Image appears blurry (sharpness ${imageSharpness?.toFixed(3)}, entropy ${imageEntropy?.toFixed(2)}).`
          );
          if (score === "high") score = "medium";
        } else if (imageEntropy < BLUR_ENTROPY_THRESHOLD) {
          issues.push(
            `Image has very low detail (entropy ${imageEntropy?.toFixed(2)}). It may be blurry or a blank page.`
          );
          if (score === "high") score = "medium";
        }
      } catch {
        issues.push("Could not perform blur detection - proceeding anyway.");
      }
    } catch (imgErr) {
      const msg = imgErr instanceof Error ? imgErr.message : String(imgErr);
      issues.push(`Failed to read image: ${msg}`);
      score = "rejected";
    }
  }

  // --- 4. PDF-specific validation ------------------------------------------
  if (isPdf) {
    pageCount = countPdfPages(buffer);

    if (pageCount === 0) {
      issues.push("Could not parse PDF page count - file may be corrupt.");
      score = "rejected";
    } else if (pageCount > PDF_PAGE_COUNT_LOW) {
      score = "low";
      issues.push(
        `PDF has ${pageCount} pages. Large documents increase cost and may exceed context limits.`
      );
    } else if (pageCount > PDF_PAGE_COUNT_MEDIUM) {
      score = "medium";
      issues.push(
        `PDF has ${pageCount} pages. Consider uploading only the relevant sheets.`
      );
    }
  }

  // --- 5. Token estimation -------------------------------------------------
  const estimatedTokenCount = estimateTokensInternal(
    buffer,
    mimeType,
    dimensions,
    pageCount
  );

  // --- 6. Build guidance ---------------------------------------------------
  const guidance = generateGuidance(score, issues, dimensions, pageCount);
  const valid = score !== "rejected";

  return buildResult({
    valid,
    score,
    dimensions,
    fileSize: buffer.length,
    fileType: mimeType,
    pageCount,
    issues,
    guidance,
    estimatedTokenCount,
  });
}

/**
 * Estimates the Claude token cost for a drawing without running the full
 * validation pipeline.
 */
export function estimateTokenCount(
  buffer: Buffer,
  mimeType: string
): number {
  return estimateTokensInternal(buffer, mimeType);
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function buildResult(
  partial: Omit<ValidationResult, "valid" | "score" | "issues" | "guidance"> &
    Pick<ValidationResult, "valid" | "score" | "issues" | "guidance">
): ValidationResult {
  return {
    valid: partial.valid,
    score: partial.score,
    dimensions: partial.dimensions,
    fileSize: partial.fileSize,
    fileType: partial.fileType,
    pageCount: partial.pageCount,
    issues: partial.issues,
    guidance: partial.guidance,
    estimatedTokenCount: partial.estimatedTokenCount,
  };
}

function countPdfPages(buffer: Buffer): number {
  try {
    const raw = buffer.toString("latin1");
    const pageMatches = raw.match(/\/Type\s*\/Page\b/g);
    const pagesNodeMatches = raw.match(/\/Type\s*\/Pages\b/g);
    const pageCount = (pageMatches?.length ?? 0) - (pagesNodeMatches?.length ?? 0);
    return Math.max(pageCount, 0);
  } catch {
    return 0;
  }
}

function estimateTokensInternal(
  _buffer: Buffer,
  mimeType: string,
  dimensions?: { width: number; height: number },
  pageCount?: number
): number {
  let estimate = 0;
  if (mimeType.startsWith("image/")) {
    const w = dimensions?.width ?? 0;
    const h = dimensions?.height ?? 0;
    if (w > 0 && h > 0) {
      estimate = Math.ceil((w * h / 1000) * TOKENS_PER_1000PX2);
    } else {
      estimate = 50_000;
    }
  } else if (mimeType === "application/pdf") {
    estimate = (pageCount && pageCount > 0 ? pageCount : 1) * TOKENS_PER_PDF_PAGE;
  }
  return Math.min(estimate, MAX_TOKEN_DISPLAY);
}

function generateGuidance(
  score: ImageQualityScore,
  issues: string[],
  dimensions?: { width: number; height: number },
  pageCount?: number
): string {
  if (score === "rejected") {
    if (issues.some((i) => i.includes("Unsupported"))) {
      return "This file type is not supported. Please upload JPEG, PNG, WebP, GIF, or PDF files only.";
    }
    if (issues.some((i) => i.includes("File size"))) {
      return "This file is too large. Compress the image or split the PDF into smaller parts.";
    }
    if (dimensions) {
      const shortest = Math.min(dimensions.width, dimensions.height);
      return `This image is too small for reliable symbol detection (${dimensions.width}x${dimensions.height}px, shortest side ${shortest}px). Re-scan at 200 DPI or higher, or take the photo closer to the plan.`;
    }
    if (issues.some((i) => i.includes("corrupt"))) {
      return "The file could not be read. It may be corrupt - try re-saving or re-exporting it.";
    }
    return "This file does not meet the minimum quality requirements. Please try a different upload.";
  }

  if (score === "low" || score === "medium") {
    const parts: string[] = [];
    if (dimensions) {
      const shortest = Math.min(dimensions.width, dimensions.height);
      if (shortest < LOW_THRESHOLD) {
        parts.push("This image is low resolution. The AI may miss small symbols or text. For best results, re-scan at 200 DPI or take the photo closer to the plan.");
      } else if (shortest < MEDIUM_THRESHOLD) {
        parts.push("Image resolution is moderate. Most symbols should be readable, but very small text may be missed.");
      }
    }
    if (issues.some((i) => i.includes("blurry") || i.includes("entropy") || i.includes("sharpness"))) {
      parts.push("The image appears blurry. Ensure good lighting and hold the camera steady when photographing plans.");
    }
    if (pageCount && pageCount > PDF_PAGE_COUNT_MEDIUM) {
      parts.push(`This PDF has ${pageCount} pages. For best results, upload only the relevant sheets (floor plans, lighting/electrical plans, and the legend).`);
    }
    return parts.join(" ");
  }

  return "Image quality looks good. The AI should be able to read symbols and text clearly.";
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1);
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}
