import Image from "next/image";

/**
 * Product screenshot framed to its true aspect ratio so the UI is not
 * cropped. Pass intrinsic width/height from the source file.
 *
 * fit="contain" (default): letterboxes if needed, never crops.
 * fit="cover-top": fills the box, anchored to the top (for tight hero windows).
 */
export default function ProductShot({
  src,
  alt,
  width,
  height,
  priority = false,
  sizes = "(max-width: 640px) 80vw, 340px",
  className = "",
  fit = "contain",
}: {
  src: string;
  alt: string;
  width: number;
  height: number;
  priority?: boolean;
  sizes?: string;
  className?: string;
  fit?: "contain" | "cover-top";
}) {
  return (
    <div
      className={`relative w-full overflow-hidden bg-[#0a1722] ${className}`}
      style={{ aspectRatio: `${width} / ${height}` }}
    >
      <Image
        src={src}
        alt={alt}
        fill
        sizes={sizes}
        priority={priority}
        quality={90}
        className={fit === "contain" ? "object-contain object-top" : "object-cover object-top"}
      />
    </div>
  );
}
