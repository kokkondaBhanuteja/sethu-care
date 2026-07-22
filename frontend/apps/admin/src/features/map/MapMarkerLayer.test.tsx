import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Map as MapLibreMap } from "maplibre-gl";
import { describe, expect, it, vi } from "vitest";

import { MAP_JOBS, MAP_PROVIDERS, MAP_ZONES } from "./map.fixtures";
import { MapMarkerLayer } from "./MapMarkerLayer";
import type { MapClusteringController } from "./useMapClustering";
import type { MapProvider } from "./map.types";
import type { VisibleMarkers } from "./map.selectors";

// The layer's own rules — the 200-marker cap and what clustered mode may still draw — tested
// against a doubled MapLibre, since jsdom cannot host the real one.

vi.mock("maplibre-gl", () => {
  class FakeMap {
    containerElement: HTMLElement;
    constructor(options: { container: HTMLElement }) {
      this.containerElement = options.container;
    }
  }
  class FakeMarker {
    element: HTMLElement;
    constructor(options: { element: HTMLElement }) {
      this.element = options.element;
    }
    setLngLat() {
      return this;
    }
    addTo(mapInstance: FakeMap) {
      mapInstance.containerElement.appendChild(this.element);
      return this;
    }
    remove() {
      this.element.remove();
    }
  }
  return { Map: FakeMap, Marker: FakeMarker };
});

const inactiveClustering: MapClusteringController = {
  isClusteringActive: false,
  engineClusters: [],
  unclusteredMarkerIds: null,
  expandCluster: () => undefined,
};

function fakeProviders(count: number): MapProvider[] {
  return [...Array(count).keys()].map((index) => ({
    id: `FP-${index}`,
    name: `Provider ${index}`,
    status: "online" as const,
    zoneId: "kompally",
    position: { latitude: 17.4, longitude: 78.4 },
    locatedAt: new Date().toISOString(),
  }));
}

function renderLayer(markers: VisibleMarkers, clustering: MapClusteringController) {
  const containerElement = document.createElement("div");
  document.body.appendChild(containerElement);
  const mapInstance = new MapLibreMap({ container: containerElement });
  const view = render(
    <MapMarkerLayer
      mapInstance={mapInstance}
      visibleBounds={null}
      markers={markers}
      clustering={clustering}
      zones={MAP_ZONES}
      zoneNameOf={(zoneId) => zoneId}
      onSelectProvider={() => undefined}
      onSelectJob={() => undefined}
      onSelectCluster={() => undefined}
    />,
  );
  return { view, containerElement };
}

describe("MapMarkerLayer", () => {
  it("hard-caps the DOM at 200 markers, jobs first (spec §6.7)", () => {
    const { containerElement } = renderLayer(
      { providers: fakeProviders(210), jobs: MAP_JOBS, clusters: [], attention: [] },
      inactiveClustering,
    );

    const buttons = containerElement.querySelectorAll("button");
    expect(buttons).toHaveLength(200);
    // All 7 fixture jobs survive; providers absorb the whole cut.
    expect(containerElement.querySelectorAll(".map-marker__job")).toHaveLength(MAP_JOBS.length);
  });

  it("in clustered mode draws only free pins, engine clusters and — always — the escalation", async () => {
    const expandCluster = vi.fn();
    const clustering: MapClusteringController = {
      isClusteringActive: true,
      engineClusters: [
        { clusterId: 3, markerCount: 23, position: { latitude: 17.5, longitude: 78.4 } },
      ],
      unclusteredMarkerIds: new Set(["P-2041"]),
      expandCluster,
    };
    renderLayer(
      { providers: MAP_PROVIDERS, jobs: MAP_JOBS, clusters: [], attention: [] },
      clustering,
    );

    // The one free provider and the escalated job keep their buttons; everything else is grouped.
    expect(
      screen.getByRole("button", { name: "Suresh Malla — Available, kompally" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "B-8823 — AC Repair, Escalated, kompally" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Anil Beeram — Available, kompally" }),
    ).not.toBeInTheDocument();

    const clusterButton = screen.getByRole("button", {
      name: "23 markers — zoom in to separate them",
    });
    await userEvent.click(clusterButton);
    expect(expandCluster).toHaveBeenCalledWith(clustering.engineClusters[0]);
  });
});
