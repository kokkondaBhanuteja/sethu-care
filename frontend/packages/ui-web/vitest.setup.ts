import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// vitest globals are off, so RTL's auto-cleanup never registers itself — without this, renders
// leak across tests and Radix overlays leave pointer-events:none on <body>, blocking later clicks.
afterEach(cleanup);
