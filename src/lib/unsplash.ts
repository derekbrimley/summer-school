const UNSPLASH_ACCESS_KEY = process.env.UNSPLASH_ACCESS_KEY;

interface UnsplashPhoto {
  urls: { regular: string; small: string };
  alt_description: string | null;
  user: { name: string };
}

export async function searchUnsplashImage(
  query: string
): Promise<{ url: string; alt: string; credit: string } | null> {
  if (!UNSPLASH_ACCESS_KEY) return null;

  const params = new URLSearchParams({
    query,
    per_page: "1",
    orientation: "landscape",
    content_filter: "high",
  });

  const res = await fetch(
    `https://api.unsplash.com/search/photos?${params}`,
    { headers: { Authorization: `Client-ID ${UNSPLASH_ACCESS_KEY}` } }
  );

  if (!res.ok) return null;

  const data = await res.json();
  const photo: UnsplashPhoto | undefined = data.results?.[0];
  if (!photo) return null;

  return {
    url: photo.urls.regular,
    alt: photo.alt_description ?? query,
    credit: photo.user.name,
  };
}

export async function fetchLessonImages(
  imageSuggestions: string[]
): Promise<(string | null)[]> {
  return Promise.all(
    imageSuggestions.map(async (suggestion) => {
      const result = await searchUnsplashImage(suggestion);
      return result?.url ?? null;
    })
  );
}
