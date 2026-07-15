import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  listAddressesOptions,
  listAddressesQueryKey,
  createAddressMutation,
} from "@sethu/api-client";

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
