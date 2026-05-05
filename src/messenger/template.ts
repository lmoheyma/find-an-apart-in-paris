export interface TemplateVariables {
  title: string;
  price: number | null;
  city: string | null;
  surface: number | null;
  rooms: number | null;
  url: string;
}

const KNOWN_VARS = ["title", "price", "city", "surface", "rooms", "url"] as const;

export function interpolateTemplate(body: string, vars: TemplateVariables): string {
  let result = body;
  for (const key of KNOWN_VARS) {
    const value = vars[key];
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), value?.toString() ?? "");
  }
  return result;
}
