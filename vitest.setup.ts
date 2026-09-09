import { cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";

// Testing Library only registers its own automatic cleanup when Vitest runs
// with `globals: true`. This project does not, so without this hook every
// `render` in a file accumulates in the same document and queries start
// matching elements left behind by earlier tests.
afterEach(cleanup);
