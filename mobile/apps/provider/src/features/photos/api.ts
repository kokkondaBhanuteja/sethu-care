import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as ImagePicker from "expo-image-picker";
import {
  signPhotoUpload,
  recordPhoto,
  listPhotosOptions,
  listPhotosQueryKey,
} from "@sethu/api-client";

// The recorded work photos for a booking (BEFORE/AFTER evidence).
export function usePhotos(bookingId: string, enabled: boolean) {
  return useQuery({
    ...listPhotosOptions({ path: { id: bookingId } }),
    enabled: enabled && bookingId.length > 0,
  });
}

// Cloudinary's response to a signed upload — only the fields we hand back to the backend to record.
interface CloudinaryUpload {
  public_id: string;
  version: number;
  signature: string;
  secure_url: string;
}

// Add a work photo end to end: take it with the camera → get a signed upload from OUR backend →
// upload the bytes straight to Cloudinary → record the result with the backend (which verifies the
// signature). The bytes never pass through our server. Thrown error codes let the screen explain a
// denied camera permission or an unconfigured Cloudinary (the sign step 503s until credentials are
// set) without a stack trace.
export function useAddWorkPhoto(bookingId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (kind: "BEFORE" | "AFTER") => {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) throw new Error("camera-permission-denied");

      const picked = await ImagePicker.launchCameraAsync({ quality: 0.7 });
      const asset = picked.assets?.[0];
      if (picked.canceled || !asset) return null;

      const signed = await signPhotoUpload({ path: { id: bookingId } });
      if (signed.error || !signed.data?.cloud_name) throw new Error("uploads-not-configured");
      const params = signed.data;

      const form = new FormData();
      form.append("file", {
        uri: asset.uri,
        type: asset.mimeType ?? "image/jpeg",
        name: "work-photo.jpg",
      } as unknown as Blob);
      form.append("api_key", params.api_key ?? "");
      form.append("timestamp", String(params.timestamp ?? ""));
      form.append("folder", params.folder ?? "");
      form.append("signature", params.signature ?? "");

      const response = await fetch(
        `https://api.cloudinary.com/v1_1/${params.cloud_name}/image/upload`,
        { method: "POST", body: form },
      );
      if (!response.ok) throw new Error("upload-failed");
      const uploaded = (await response.json()) as CloudinaryUpload;

      const recorded = await recordPhoto({
        path: { id: bookingId },
        body: {
          kind,
          public_id: uploaded.public_id,
          version: String(uploaded.version),
          signature: uploaded.signature,
          secure_url: uploaded.secure_url,
        },
      });
      if (recorded.error) throw new Error("record-failed");
      return kind;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: listPhotosQueryKey({ path: { id: bookingId } }),
      });
    },
  });
}
