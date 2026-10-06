export const site = {
  name: "Verse",
  tagline: "Your book. Understood.",
  contactEmail: process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? "support@example.com",
};

/** Safe JSON-LD serialization (escapes `<` to prevent script injection). */
export function jsonLd(data: unknown) {
  return { __html: JSON.stringify(data).replace(/</g, "\\u003c") };
}
