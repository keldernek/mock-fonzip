import { GENERATED_TYPES_PATH } from "../src/spec/source";
import { generateTypes } from "./generate-types";

const types = await generateTypes();
await Bun.write(GENERATED_TYPES_PATH, types);
console.log(`wrote ${GENERATED_TYPES_PATH}`);
