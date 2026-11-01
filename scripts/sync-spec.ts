import { SPEC_PATH, SPEC_URL } from "../src/spec/source";

const response = await fetch(SPEC_URL);
if (!response.ok) {
  throw new Error(`GET ${SPEC_URL} answered ${response.status}`);
}
const text = await response.text();
await Bun.write(SPEC_PATH, text);
console.log(`wrote ${text.length} bytes from ${SPEC_URL} to ${SPEC_PATH}`);
