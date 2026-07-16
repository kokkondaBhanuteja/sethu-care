"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  listServicesOptions,
  listServicesQueryKey,
  createVariantMutation,
} from "@sethu/api-client";
import type { ListServicesResponse } from "@sethu/api-client";

import { Button, Card, PageHeader, StatusPill } from "@/components/ui";

type Service = NonNullable<ListServicesResponse["services"]>[number];

// The catalog: every service with its variants and prices. An admin can add a priced variant to a
// service inline (POST /services/{id}/variants) — the most common catalog edit. Creating whole
// services/categories is a documented follow-up.
export default function ServicesPage() {
  const { data, isLoading } = useQuery(listServicesOptions());
  const services = data?.services ?? [];

  return (
    <div>
      <PageHeader title="Services" subtitle="Catalog and pricing" />
      <div className="flex flex-col gap-lg">
        {services.length === 0 ? (
          <Card>{isLoading ? "Loading…" : "No services yet."}</Card>
        ) : (
          services.map((service) => <ServiceCard key={service.id} service={service} />)
        )}
      </div>
    </div>
  );
}

function ServiceCard({ service }: { service: Service }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");

  const addVariant = useMutation({
    ...createVariantMutation(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: listServicesQueryKey() });
      setName("");
      setPrice("");
    },
  });

  return (
    <Card>
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-heading text-headline-sm text-on-surface">{service.name}</h3>
          {service.description ? (
            <p className="mt-1 text-label-md text-on-surface-variant">{service.description}</p>
          ) : null}
        </div>
        {service.assignment_mode ? (
          <StatusPill label={service.assignment_mode} tone="info" />
        ) : null}
      </div>

      <div className="mt-md flex flex-col">
        {(service.variants ?? []).map((variant) => (
          <div
            key={variant.id}
            className="flex justify-between border-b border-outline-variant/40 py-sm text-body-md"
          >
            <span>{variant.name}</span>
            <span className="font-medium">₹{variant.price}</span>
          </div>
        ))}
      </div>

      <div className="mt-md flex flex-wrap items-center gap-sm">
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="New variant name"
          className="flex-1 rounded-md border border-outline-variant px-md py-sm text-body-md outline-none focus:border-primary"
        />
        <input
          value={price}
          onChange={(event) => setPrice(event.target.value)}
          placeholder="Price ₹"
          inputMode="decimal"
          className="w-28 rounded-md border border-outline-variant px-md py-sm text-body-md outline-none focus:border-primary"
        />
        <Button
          disabled={addVariant.isPending || !name || !price || !service.id}
          onClick={() =>
            service.id && addVariant.mutate({ path: { id: service.id }, body: { name, price } })
          }
        >
          Add variant
        </Button>
      </div>
    </Card>
  );
}
