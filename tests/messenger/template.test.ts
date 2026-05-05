import { describe, it, expect } from "vitest";
import { interpolateTemplate } from "../../src/messenger/template.js";

describe("interpolateTemplate", () => {
  it("replaces all known variables", () => {
    const body = "Bonjour, intéressé par {{title}} à {{price}}€ ({{surface}}m², {{rooms}} pièces) à {{city}}. Lien: {{url}}";
    const result = interpolateTemplate(body, {
      title: "Studio lumineux",
      price: 900,
      city: "Paris 11",
      surface: 25,
      rooms: 1,
      url: "https://leboncoin.fr/123",
    });
    expect(result).toBe("Bonjour, intéressé par Studio lumineux à 900€ (25m², 1 pièces) à Paris 11. Lien: https://leboncoin.fr/123");
  });

  it("leaves unknown variables untouched", () => {
    const result = interpolateTemplate("Hello {{unknown}}", { title: "X", price: 0, city: "", surface: 0, rooms: 0, url: "" });
    expect(result).toBe("Hello {{unknown}}");
  });

  it("handles null values gracefully", () => {
    const result = interpolateTemplate("Prix: {{price}}€", { title: "", price: null, city: "", surface: null, rooms: null, url: "" });
    expect(result).toBe("Prix: €");
  });
});
