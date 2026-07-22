import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { MAP_DEFAULT_VIEWPORT } from "./map.constants";
import { MAP_ATTENTION, MAP_CLUSTERS, MAP_JOBS, MAP_PROVIDERS, MAP_ZONES } from "./map.fixtures";
import { MapSurface } from "./MapSurface";
import type { MapSurfaceProps } from "./MapSurface";

// jsdom has no WebGL, so MapLibre is doubled at the module boundary and the tests cover the wiring
// around it: construction options, the attribution control, marker buttons, teardown.

const doubles = vi.hoisted(() => ({
  mapOptions: [] as Record<string, unknown>[],
  attributionControls: [] as { options: unknown; position: string | undefined }[],
  removedMapCount: 0,
  reset() {
    this.mapOptions = [];
    this.attributionControls = [];
    this.removedMapCount = 0;
  },
}));

vi.mock("maplibre-gl", () => {
  class FakeMap {
    containerElement: HTMLElement;
    touchZoomRotate = { disableRotation: () => undefined };
    constructor(options: { container: HTMLElement } & Record<string, unknown>) {
      doubles.mapOptions.push(options);
      this.containerElement = options.container;
    }
    addControl(control: { position?: string }, position?: string) {
      doubles.attributionControls.push({ options: control, position });
    }
    on() {}
    off() {}
    easeTo() {}
    resize() {}
    remove() {
      doubles.removedMapCount += 1;
    }
    isStyleLoaded() {
      return true;
    }
    getBounds() {
      return { getWest: () => 60, getSouth: () => 0, getEast: () => 90, getNorth: () => 30 };
    }
    addSource() {}
    getSource() {
      return undefined;
    }
    addLayer() {}
    getLayer() {
      return undefined;
    }
    removeLayer() {}
    removeSource() {}
    querySourceFeatures() {
      return [];
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
  class FakeAttributionControl {
    options: unknown;
    constructor(options: unknown) {
      this.options = options;
    }
  }
  return { Map: FakeMap, Marker: FakeMarker, AttributionControl: FakeAttributionControl };
});

function renderSurface(overrides: Partial<MapSurfaceProps> = {}) {
  doubles.reset();
  const handlers = {
    onSelectProvider: vi.fn(),
    onSelectJob: vi.fn(),
    onSelectCluster: vi.fn(),
  };
  const view = render(
    <MapSurface
      surface="desktop"
      viewport={MAP_DEFAULT_VIEWPORT}
      markers={{
        providers: MAP_PROVIDERS,
        jobs: MAP_JOBS,
        clusters: MAP_CLUSTERS,
        attention: MAP_ATTENTION,
      }}
      zones={MAP_ZONES}
      zoneNameOf={(zoneId) => zoneId}
      showServiceAreas={false}
      showDemandHeatmap={false}
      {...handlers}
      {...overrides}
    />,
  );
  return { view, handlers };
}

describe("MapSurface", () => {
  it("boots the GL map on the OSM style with tilt and rotation off, and removes it on unmount", () => {
    const { view } = renderSurface();

    expect(doubles.mapOptions).toHaveLength(1);
    const options = doubles.mapOptions[0] as {
      style: { sources: Record<string, { tiles: string[]; attribution: string }> };
      maxPitch: number;
      dragRotate: boolean;
      attributionControl: boolean;
    };
    const source = options.style.sources["osm-base"];
    expect(source?.tiles).toEqual(["https://tile.openstreetmap.org/{z}/{x}/{y}.png"]);
    expect(source?.attribution).toContain("OpenStreetMap");
    expect(options.maxPitch).toBe(0);
    expect(options.dragRotate).toBe(false);

    view.unmount();
    expect(doubles.removedMapCount).toBe(1);
  });

  it("adds a visible, non-compact attribution control — bottom-right on desktop, top-right on mobile", () => {
    const { view } = renderSurface();
    expect(doubles.attributionControls[0]?.position).toBe("bottom-right");
    expect(doubles.attributionControls[0]?.options).toMatchObject({
      options: { compact: false },
    });
    view.unmount();

    renderSurface({ surface: "mobile" });
    expect(doubles.attributionControls[0]?.position).toBe("top-right");
  });

  it("renders every marker as an accessible button whose name carries the status word", async () => {
    const { handlers } = renderSurface();

    const providerButton = screen.getByRole("button", {
      name: "Suresh Malla — Available, kompally",
    });
    expect(
      screen.getByRole("button", { name: "B-8823 — AC Repair, Escalated, kompally" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "12 markers in madhapur — list them" }),
    ).toBeInTheDocument();

    await userEvent.click(providerButton);
    expect(handlers.onSelectProvider).toHaveBeenCalledWith(
      expect.objectContaining({ id: "P-2041" }),
    );
  });

  it("gives the one escalated job its pulse ring", () => {
    const { view } = renderSurface();
    expect(view.baseElement.querySelectorAll(".map-marker__pulse")).toHaveLength(1);
  });
});
