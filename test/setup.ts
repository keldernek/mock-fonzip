import { afterAll } from "bun:test";

import { writeCoverage } from "../src/testing/coverage";

afterAll(writeCoverage);
