// const fs = require("fs");

class WASM {
  #exports = {};
  #buf;
  #stdout;
  #module;

  #env = {
    print: (ptr) => this.#stdout(`${this.readString(ptr)}\n`),
    print_raw: (ptr) => this.#stdout(this.readString(ptr)),
    print_long: (long) => console.log(long),
    throw_exit: (ptr) => {
      const err = this.readString(ptr);
      this.#stdout(`Error: ${err}\nexiting ...\n`);
      this.reset();
      throw "ignore me";
    },
    exit: (code) => {
      this.#stdout(`exited with code: ${code}`);
      throw "ignore me";
    },
    log_bytes: (ptr, size) => {
      const arr = new Uint8Array(this.#exports.memory.buffer, ptr, size);
      console.log(arr);
    },
  };

  #inited = false;

  constructor(buf, stdout, env = {}) {
    this.#buf = buf;
    this.#env = Object.assign(this.#env, env);
    this.#stdout = stdout;
  }

  async init() {
    if (this.#inited) return;
    this.#inited = true;
    const wasm = await WebAssembly.instantiate(this.#buf, { env: this.#env });
    this.#module = wasm.module;
    this.#exports = wasm.instance.exports;
    for (const key of Object.keys(this.#exports))
      this[key] = this.#exports[key];
    this.#stdout("ready");
  }

  allocString(str = "") {
    const ptr = this.#exports.malloc(str.length); //
    const arr = new Uint8Array(
      this.#exports.memory.buffer,
      ptr,
      str.length + 1,
    );
    arr.set(str.split("").map((c) => c.charCodeAt(0)));
    arr.set([0], str.length); // null byte
    return ptr;
  }

  readString(ptr = 0) {
    let str = "";
    let i = 0;
    while (true) {
      const arr = new Uint8Array(this.#exports.memory.buffer, ptr + i++, 1);
      const code = arr.at(0);
      if (code === 0) break;
      str += String.fromCharCode(code);
    }
    return str;
  }

  async reset() {
    const instance = await WebAssembly.instantiate(this.#module, {
      env: this.#env,
    });
    this.#exports = instance.exports;
    for (const key of Object.keys(this.#exports))
      this[key] = this.#exports[key];
  }
}

// module.exports = WASM;
