import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  listAddressesOptions,
  listAddressesQueryKey,
  createAddressMutation,
} from "@sethu/api-client";

// The customer's saved delivery addresses, straight from the contract. Creating one invalidates the
// list so the location picker reflects it immediately.
export function useAddresses() {
  return useQuery(listAddressesOptions());
}

export function useCreateAddress() {
  const queryClient = useQueryClient();
  return useMutation({
    ...createAddressMutation(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: listAddressesQueryKey() }),
  });
}
