// Service imagery now lives in @sethu/ui so every app (customer, provider) shares the same clay icons,
// photos, and mascot. Re-exported here so existing `@/features/catalog` imports keep working.
export {
  SERVICE_IMAGES,
  SERVICE_PHOTOS,
  serviceImage,
  servicePhoto,
  serviceIcon,
  sampleRating,
  heroMascot,
} from "@sethu/ui";
