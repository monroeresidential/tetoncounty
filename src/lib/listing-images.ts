import catalog from '../../public/data/listing-images.json';

// The source inventory's imageUrl is a research lead, not publication approval.
// Only the separate reviewed catalog can supply a listing's public photograph.
export const listingImages = new Map(catalog.images
  .filter(image => image.status === 'approved')
  .map(image => [image.listingId, image]));
export const listingImagePaths = new Map([...listingImages.values()].map(image => [image.src, image]));
export const listingImageFor = (id: string) => listingImages.get(id);
