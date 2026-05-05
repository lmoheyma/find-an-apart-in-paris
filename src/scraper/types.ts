export interface ScrapedListing {
  external_id: string;
  url: string;
  title: string;
  price: number | null;
  surface: number | null;
  rooms: number | null;
  city: string | null;
  description: string | null;
  images: string[];
  contact_email: string | null;
}
