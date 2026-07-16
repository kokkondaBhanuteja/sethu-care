"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  listCategoriesOptions,
  listCategoriesQueryKey,
  listServicesQueryKey,
  createCategoryMutation,
  createServiceMutation,
} from "@sethu/api-client";

import { Button, Card } from "@/components/ui";

const inputClass =
  "rounded-md border border-outline-variant px-md py-sm text-body-md outline-none focus:border-primary";

// Create a catalog category. Slug must be unique; the backend rejects a duplicate.
export function NewCategoryForm() {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [sortOrder, setSortOrder] = useState("0");

  const create = useMutation({
    ...createCategoryMutation(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: listCategoriesQueryKey() });
      setName("");
      setSlug("");
      setSortOrder("0");
    },
  });

  return (
    <Card>
      <h3 className="font-heading text-headline-sm text-on-surface">New category</h3>
      <div className="mt-md flex flex-wrap items-center gap-sm">
        <input
          className={`${inputClass} flex-1`}
          placeholder="Name"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
        <input
          className={`${inputClass} flex-1`}
          placeholder="Slug (e.g. appliance-repair)"
          value={slug}
          onChange={(event) => setSlug(event.target.value)}
        />
        <input
          className={`${inputClass} w-24`}
          placeholder="Sort"
          inputMode="numeric"
          value={sortOrder}
          onChange={(event) => setSortOrder(event.target.value)}
        />
        <Button
          disabled={create.isPending || !name || !slug}
          onClick={() =>
            create.mutate({ body: { name, slug, sort_order: Number(sortOrder) || 0 } })
          }
        >
          Create
        </Button>
      </div>
      {create.isError ? (
        <p className="mt-sm text-label-md text-error">
          Couldn&apos;t create the category — is the slug unique?
        </p>
      ) : null}
    </Card>
  );
}

// Create a service under a category. Needs a category to exist first (dropdown).
export function NewServiceForm() {
  const queryClient = useQueryClient();
  const { data } = useQuery(listCategoriesOptions());
  const categories = data?.categories ?? [];

  const [categoryId, setCategoryId] = useState("");
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [mode, setMode] = useState("AUTO");
  const [minutes, setMinutes] = useState("60");

  const create = useMutation({
    ...createServiceMutation(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: listServicesQueryKey() });
      setName("");
      setSlug("");
      setDescription("");
    },
  });

  return (
    <Card>
      <h3 className="font-heading text-headline-sm text-on-surface">New service</h3>
      <div className="mt-md grid grid-cols-1 gap-sm sm:grid-cols-2">
        <select
          className={inputClass}
          value={categoryId}
          onChange={(event) => setCategoryId(event.target.value)}
        >
          <option value="">Select category…</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
        <select
          className={inputClass}
          value={mode}
          onChange={(event) => setMode(event.target.value)}
        >
          <option value="AUTO">Auto-assign</option>
          <option value="MANUAL">Manual-assign</option>
        </select>
        <input
          className={inputClass}
          placeholder="Name"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
        <input
          className={inputClass}
          placeholder="Slug"
          value={slug}
          onChange={(event) => setSlug(event.target.value)}
        />
        <input
          className={`${inputClass} sm:col-span-2`}
          placeholder="Description"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />
        <input
          className={inputClass}
          placeholder="Estimated minutes"
          inputMode="numeric"
          value={minutes}
          onChange={(event) => setMinutes(event.target.value)}
        />
      </div>
      <div className="mt-md">
        <Button
          disabled={create.isPending || !categoryId || !name || !slug}
          onClick={() =>
            create.mutate({
              body: {
                category_id: categoryId,
                name,
                slug,
                description,
                assignment_mode: mode,
                estimated_minutes: Number(minutes) || 60,
              },
            })
          }
        >
          Create service
        </Button>
      </div>
      {create.isError ? (
        <p className="mt-sm text-label-md text-error">
          Couldn&apos;t create the service — check the slug is unique and a category is selected.
        </p>
      ) : null}
    </Card>
  );
}
