const wasm_container = {};

const ta = document.getElementById("ta");
const btn = document.getElementById("btn");
const out = document.getElementById("out");

function stdout(str) {
  out.value += str;
}

btn.onclick = () => {
  if (!wasm_container.wasm) return;
  const wasm = wasm_container.wasm;
  const ptr = wasm.allocString(ta.value);
  out.value = "";
  wasm.run_source(ptr);
};

main();
async function main() {
  out.value = "";
  const buf = await (await fetch("wasm-compiler.wasm")).arrayBuffer();
  const wasm = new WASM(buf, stdout);
  await wasm.init();
  wasm_container.wasm = wasm;
  console.log("wasm");
}
