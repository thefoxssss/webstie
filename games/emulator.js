const WORD_MASK = 0xffff;
const MEMORY_SIZE = 0x10000;
const PROGRAM_START = 0x0500;
const CONTEXT_BASE = 0x0400;
const IO_INPUT_STATUS = 0x00f0;
const IO_INPUT_DATA = 0x00f1;
const IO_OUTPUT_DATA = 0x00f2;
const IO_OUTPUT_CLEAR = 0x00f3;

const OPCODE_META = {
  0x00: { rr: false, im: false, name: "NOOP" },
  0x01: { rr: true, im: true, name: "LFI" },
  0x02: { rr: true, im: false, name: "LFA" },
  0x03: { rr: true, im: false, name: "LFAL" },
  0x04: { rr: true, im: false, name: "LFAH" },
  0x05: { rr: true, im: false, name: "STO" },
  0x06: { rr: true, im: false, name: "STOL" },
  0x07: { rr: true, im: false, name: "STOH" },
  0x08: { rr: true, im: false, name: "MVR" },
  0x09: { rr: true, im: false, name: "SWR" },
  0x0a: { rr: true, im: false, name: "SWP" },
  0x0b: { rr: true, im: false, name: "NOT" },
  0x0c: { rr: true, im: false, name: "AND" },
  0x0d: { rr: true, im: false, name: "OR" },
  0x0e: { rr: true, im: false, name: "XOR" },
  0x0f: { rr: true, im: false, name: "NOR" },
  0x10: { rr: true, im: false, name: "SHR" },
  0x11: { rr: true, im: false, name: "SHL" },
  0x12: { rr: true, im: false, name: "ROR" },
  0x13: { rr: true, im: false, name: "ROL" },
  0x14: { rr: true, im: false, name: "ADD" },
  0x15: { rr: true, im: false, name: "SUB" },
  0x16: { rr: true, im: false, name: "MUL" },
  0x17: { rr: true, im: false, name: "DEV" },
  0x18: { rr: true, im: false, name: "EVE" },
  0x19: { rr: true, im: false, name: "EVGT" },
  0x1a: { rr: true, im: false, name: "EVLT" },
  0x1b: { rr: true, im: false, name: "EVGTE" },
  0x1c: { rr: true, im: false, name: "EVLTE" },
  0x1d: { rr: false, im: false, name: "EVNOT" },
  0x1e: { rr: false, im: false, name: "EVST" },
  0x1f: { rr: false, im: false, name: "EVSF" },
  0x20: { rr: false, im: false, name: "EVOF" },
  0x21: { rr: false, im: false, name: "EVZF" },
  0x22: { rr: false, im: false, name: "EVCA" },
  0x23: { rr: true, im: false, name: "JMP" },
  0x24: { rr: true, im: false, name: "JMPC" },
  0x25: { rr: true, im: false, name: "JRA" },
  0x26: { rr: true, im: false, name: "JRS" },
  0x27: { rr: true, im: false, name: "JRAC" },
  0x28: { rr: true, im: false, name: "JRSC" },
  0x29: { rr: false, im: true, name: "JRIA" },
  0x2a: { rr: false, im: true, name: "JRIS" },
  0x2b: { rr: false, im: true, name: "JRIAC" },
  0x2c: { rr: false, im: true, name: "JRISC" },
  0x2d: { rr: true, im: false, name: "JTSR" },
  0x2e: { rr: true, im: false, name: "JTSRC" },
  0x2f: { rr: false, im: false, name: "RFSR" },
  0x30: { rr: false, im: false, name: "RFSRC" },
  0x31: { rr: false, im: false, name: "HALT" },
  0x32: { rr: true, im: false, name: "INT" },
  0x33: { rr: false, im: true, name: "INTI" },
  0x34: { rr: false, im: false, name: "RFI" },
  0x35: { rr: false, im: false, name: "SBI" },
  0x36: { rr: false, im: false, name: "CBI" },
  0x37: { rr: false, im: false, name: "SPF" },
  0x38: { rr: false, im: false, name: "CPF" },
  0x39: { rr: true, im: false, name: "SLMB" },
  0x3a: { rr: true, im: false, name: "SLME" },
};


const MNEMONIC_TO_OPCODE = Object.fromEntries(
  Object.entries(OPCODE_META).map(([opcode, meta]) => [meta.name, Number(opcode)]),
);

function splitAssemblerOperands(rawOperands) {
  if (!rawOperands) return [];
  return rawOperands
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

function parseRegisterToken(token, lineNumber) {
  const match = /^R([0-9A-F])$/i.exec(token);
  if (!match) {
    throw new Error(`Line ${lineNumber}: expected register token (R0-RF), got "${token}".`);
  }
  return Number.parseInt(match[1], 16);
}

function parseImmediateToken(token, labels, lineNumber) {
  if (token in labels) return labels[token];
  if (/^0x[\da-f]+$/i.test(token)) return Number.parseInt(token.slice(2), 16) & WORD_MASK;
  if (/^-?\d+$/.test(token)) return Number.parseInt(token, 10) & WORD_MASK;
  throw new Error(`Line ${lineNumber}: invalid immediate/label token "${token}".`);
}

class Emulator {
  constructor() {
    this.registers = new Uint16Array(16);
    this.memory = new Uint8Array(MEMORY_SIZE);
    this.logs = [];
    this.reset();
  }

  reset() {
    this.registers.fill(0);
    this.memory.fill(0);
    this.pc = PROGRAM_START;
    this.cf = false;
    this.pf = true;
    this.ov = false;
    this.ca = false;
    this.zf = false;
    this.iflag = false;
    this.bif = false;
    this.localMemoryBegin = 0;
    this.localMemoryEnd = WORD_MASK;
    this.halted = false;
    this.logs = [];
    this.terminalOutput = "";
    this.inputQueue = [];
    this.memory[0x0001] = 0;
  }

  instructionSize(opcode) {
    const meta = OPCODE_META[opcode];
    if (!meta) return 1;
    return 1 + (meta.rr ? 1 : 0) + (meta.im ? 2 : 0);
  }

  parseProgram(hexText) {
    const bytes = [];
    const cleaned = hexText.replace(/[^a-fA-F0-9]/g, "");
    if (cleaned.length % 2 !== 0) {
      throw new Error("Program hex must have an even number of digits.");
    }
    for (let i = 0; i < cleaned.length; i += 2) {
      bytes.push(Number.parseInt(cleaned.slice(i, i + 2), 16));
    }
    return bytes;
  }

  bytesToHex(bytes) {
    return bytes.map((value) => value.toString(16).toUpperCase().padStart(2, "0")).join(" ");
  }

  assembleProgram(assemblyText) {
    const lines = assemblyText.split(/\r?\n/);
    const parsed = [];
    const labels = {};
    let address = PROGRAM_START;

    for (let index = 0; index < lines.length; index += 1) {
      const lineNumber = index + 1;
      const noComment = lines[index].replace(/[#;].*$/, "").trim();
      if (!noComment) continue;

      let working = noComment;
      while (working.includes(":")) {
        const labelMatch = /^([A-Za-z_][\w]*):\s*(.*)$/.exec(working);
        if (!labelMatch) break;
        const label = labelMatch[1];
        if (labels[label] !== undefined) {
          throw new Error(`Line ${lineNumber}: duplicate label "${label}".`);
        }
        labels[label] = address & WORD_MASK;
        working = labelMatch[2].trim();
        if (!working) break;
      }
      if (!working) continue;

      const firstSpace = working.search(/\s/);
      const mnemonic = (firstSpace === -1 ? working : working.slice(0, firstSpace)).toUpperCase();
      const rawOperands = firstSpace === -1 ? "" : working.slice(firstSpace + 1).trim();
      const operands = splitAssemblerOperands(rawOperands);
      const opcode = MNEMONIC_TO_OPCODE[mnemonic];
      if (opcode === undefined) {
        throw new Error(`Line ${lineNumber}: unknown opcode "${mnemonic}".`);
      }

      const size = this.instructionSize(opcode);
      parsed.push({ lineNumber, opcode, mnemonic, operands, address: address & WORD_MASK });
      address = (address + size) & WORD_MASK;
    }

    const bytes = [];
    for (const instruction of parsed) {
      const meta = OPCODE_META[instruction.opcode];
      const { operands, lineNumber } = instruction;
      let r1 = 0;
      let r2 = 0;
      let immediate;

      if (meta.rr && meta.im) {
        if (operands.length < 2 || operands.length > 3) {
          throw new Error(`Line ${lineNumber}: ${instruction.mnemonic} expects Rn, imm (optional second register).`);
        }
        r1 = parseRegisterToken(operands[0], lineNumber);
        immediate = parseImmediateToken(operands[1], labels, lineNumber);
        if (operands[2]) r2 = parseRegisterToken(operands[2], lineNumber);
      } else if (meta.rr) {
        if (operands.length < 1 || operands.length > 2) {
          throw new Error(`Line ${lineNumber}: ${instruction.mnemonic} expects Rn or Rn, Rm.`);
        }
        r1 = parseRegisterToken(operands[0], lineNumber);
        if (operands[1]) r2 = parseRegisterToken(operands[1], lineNumber);
      } else if (meta.im) {
        if (operands.length !== 1) {
          throw new Error(`Line ${lineNumber}: ${instruction.mnemonic} expects one immediate operand.`);
        }
        immediate = parseImmediateToken(operands[0], labels, lineNumber);
      } else if (operands.length !== 0) {
        throw new Error(`Line ${lineNumber}: ${instruction.mnemonic} takes no operands.`);
      }

      bytes.push(instruction.opcode & 0xff);
      if (meta.rr) bytes.push(((r1 & 0xf) << 4) | (r2 & 0xf));
      if (meta.im) {
        const value = immediate & WORD_MASK;
        bytes.push((value >> 8) & 0xff, value & 0xff);
      }
    }

    return bytes;
  }

  loadProgram(hexText) {
    const bytes = this.parseProgram(hexText);
    this.reset();
    for (let i = 0; i < bytes.length && PROGRAM_START + i < MEMORY_SIZE; i += 1) {
      this.memory[PROGRAM_START + i] = bytes[i];
    }
    this.log(`Loaded ${bytes.length} bytes @ 0x${this.hex(PROGRAM_START)}`);
  }

  hex(value, width = 4) {
    return (value & WORD_MASK).toString(16).toUpperCase().padStart(width, "0");
  }

  appendTerminalOutput(value) {
    const char = String.fromCharCode(value & 0xff);
    this.terminalOutput = (this.terminalOutput + char).slice(-1200);
  }

  enqueueTerminalInput(text) {
    if (!text) return;
    for (const char of text) {
      this.inputQueue.push(char.charCodeAt(0) & 0xff);
    }
    this.inputQueue.push(0x0a);
    this.log(`TERM IN <= "${text}"`);
  }

  readByte(address, privilegedBypass = false) {
    const addr = address & WORD_MASK;
    if (!privilegedBypass && !this.canAccess(addr)) {
      this.handleInterrupt(0x00);
      throw new Error(`Memory access violation @0x${this.hex(addr)}`);
    }

    if (addr === IO_INPUT_STATUS) {
      return this.inputQueue.length > 0 ? 1 : 0;
    }
    if (addr === IO_INPUT_DATA) {
      return this.inputQueue.length > 0 ? this.inputQueue.shift() : 0;
    }
    return this.memory[addr];
  }

  writeByte(address, value, privilegedBypass = false) {
    const addr = address & WORD_MASK;
    if (!privilegedBypass && !this.canAccess(addr)) {
      this.handleInterrupt(0x00);
      throw new Error(`Memory access violation @0x${this.hex(addr)}`);
    }

    if (addr === IO_OUTPUT_DATA) {
      this.appendTerminalOutput(value);
      return;
    }
    if (addr === IO_OUTPUT_CLEAR) {
      this.terminalOutput = "";
      return;
    }

    this.memory[addr] = value & 0xff;
  }

  readWord(address, privilegedBypass = false) {
    const hi = this.readByte(address, privilegedBypass);
    const lo = this.readByte(address + 1, privilegedBypass);
    return ((hi << 8) | lo) & WORD_MASK;
  }

  writeWord(address, value, privilegedBypass = false) {
    this.writeByte(address, (value >> 8) & 0xff, privilegedBypass);
    this.writeByte(address + 1, value & 0xff, privilegedBypass);
  }

  canAccess(address) {
    if (this.pf) return true;
    return address >= this.localMemoryBegin && address <= this.localMemoryEnd;
  }

  setResultFlags(result) {
    this.zf = (result & WORD_MASK) === 0;
  }

  setAddFlags(a, b, result) {
    const sum = a + b;
    this.ca = sum > WORD_MASK;
    const sa = (a & 0x8000) !== 0;
    const sb = (b & 0x8000) !== 0;
    const sr = (result & 0x8000) !== 0;
    this.ov = sa === sb && sa !== sr;
    this.zf = (result & WORD_MASK) === 0;
  }

  setSubFlags(a, b, result) {
    this.ca = a < b;
    const sa = (a & 0x8000) !== 0;
    const sb = (b & 0x8000) !== 0;
    const sr = (result & 0x8000) !== 0;
    this.ov = sa !== sb && sa !== sr;
    this.zf = (result & WORD_MASK) === 0;
  }

  jsPush(value) {
    const ptr = this.memory[0x0001] & 0xff;
    const addr = 0x0200 + ptr;
    this.writeWord(addr, value, true);
    this.memory[0x0001] = (ptr + 2) & 0xff;
  }

  jsPop() {
    const ptr = (this.memory[0x0001] - 2) & 0xff;
    this.memory[0x0001] = ptr;
    return this.readWord(0x0200 + ptr, true);
  }

  saveContext() {
    for (let i = 0; i < 16; i += 1) {
      this.writeWord(CONTEXT_BASE + i * 2, this.registers[i], true);
    }
    this.writeWord(0x0421, this.pc, true);
    this.writeByte(0x0423, this.cf ? 1 : 0, true);
    this.writeByte(0x0424, this.pf ? 1 : 0, true);
    this.writeByte(0x0425, this.ov ? 1 : 0, true);
    this.writeByte(0x0426, this.ca ? 1 : 0, true);
    this.writeByte(0x0427, this.zf ? 1 : 0, true);
    this.writeWord(0x0428, this.localMemoryBegin, true);
    this.writeWord(0x042a, this.localMemoryEnd, true);
  }

  restoreContext() {
    for (let i = 0; i < 16; i += 1) {
      this.registers[i] = this.readWord(CONTEXT_BASE + i * 2, true);
    }
    this.pc = this.readWord(0x0421, true);
    this.cf = this.readByte(0x0423, true) === 1;
    this.pf = this.readByte(0x0424, true) === 1;
    this.ov = this.readByte(0x0425, true) === 1;
    this.ca = this.readByte(0x0426, true) === 1;
    this.zf = this.readByte(0x0427, true) === 1;
    this.localMemoryBegin = this.readWord(0x0428, true);
    this.localMemoryEnd = this.readWord(0x042a, true);
  }

  handleInterrupt(id) {
    if (this.bif) return;
    this.saveContext();
    this.iflag = true;
    const handlerAddr = this.readWord(0x0100 + ((id & 0xff) * 2), true);
    this.pc = handlerAddr;
    this.log(`INT ${this.hex(id, 2)} => handler 0x${this.hex(handlerAddr)}`);
  }

  log(message) {
    this.logs.unshift(message);
    this.logs = this.logs.slice(0, 14);
  }

  step() {
    if (this.halted) return { halted: true };

    const basePc = this.pc;
    const opcode = this.readByte(basePc, true);
    const meta = OPCODE_META[opcode] || { rr: false, im: false, name: "???" };
    const size = this.instructionSize(opcode);
    const rr = meta.rr ? this.readByte(basePc + 1, true) : 0;
    const r1 = (rr >> 4) & 0xf;
    const r2 = rr & 0xf;
    const im = meta.im ? this.readWord(basePc + (meta.rr ? 2 : 1), true) : 0;

    let jumped = false;
    const reg1 = () => this.registers[r1] & WORD_MASK;
    const reg2 = () => this.registers[r2] & WORD_MASK;
    const setR1 = (value) => {
      this.registers[r1] = value & WORD_MASK;
    };

    switch (opcode) {
      case 0x00: break;
      case 0x01: setR1(im); break;
      case 0x02: setR1(this.readWord(reg2())); break;
      case 0x03: setR1((reg1() & 0xff00) | this.readByte(reg2())); break;
      case 0x04: setR1((reg1() & 0x00ff) | (this.readByte(reg2()) << 8)); break;
      case 0x05: this.writeWord(reg2(), reg1()); break;
      case 0x06: this.writeByte(reg2(), reg1() & 0xff); break;
      case 0x07: this.writeByte(reg2(), (reg1() >> 8) & 0xff); break;
      case 0x08: setR1(reg2()); break;
      case 0x09: {
        const temp = reg1();
        this.registers[r1] = reg2();
        this.registers[r2] = temp;
        break;
      }
      case 0x0a: setR1(((reg1() & 0xff) << 8) | ((reg1() >> 8) & 0xff)); break;
      case 0x0b: setR1(~reg1()); this.setResultFlags(reg1()); break;
      case 0x0c: setR1(reg1() & reg2()); this.setResultFlags(reg1()); break;
      case 0x0d: setR1(reg1() | reg2()); this.setResultFlags(reg1()); break;
      case 0x0e: setR1(reg1() ^ reg2()); this.setResultFlags(reg1()); break;
      case 0x0f: setR1(~(reg1() | reg2())); this.setResultFlags(reg1()); break;
      case 0x10: setR1(reg1() >> (reg2() & 0xf)); this.setResultFlags(reg1()); break;
      case 0x11: {
        const shift = reg2() & 0xf;
        const result = (reg1() << shift) & WORD_MASK;
        this.ca = ((reg1() << shift) >> 16) !== 0;
        setR1(result);
        this.setResultFlags(result);
        break;
      }
      case 0x12: {
        const shift = reg2() & 0xf;
        setR1((reg1() >>> shift) | ((reg1() << (16 - shift)) & WORD_MASK));
        break;
      }
      case 0x13: {
        const shift = reg2() & 0xf;
        setR1(((reg1() << shift) & WORD_MASK) | (reg1() >>> (16 - shift)));
        break;
      }
      case 0x14: {
        const result = (reg1() + reg2()) & WORD_MASK;
        this.setAddFlags(reg1(), reg2(), result);
        setR1(result);
        break;
      }
      case 0x15: {
        const result = (reg1() - reg2()) & WORD_MASK;
        this.setSubFlags(reg1(), reg2(), result);
        setR1(result);
        break;
      }
      case 0x16: {
        const wide = reg1() * reg2();
        const result = wide & WORD_MASK;
        this.ca = wide > WORD_MASK;
        this.ov = this.ca;
        setR1(result);
        this.setResultFlags(result);
        break;
      }
      case 0x17: {
        if (reg2() === 0) {
          this.handleInterrupt(0x00);
          break;
        }
        const quotient = Math.floor(reg1() / reg2()) & WORD_MASK;
        const remainder = (reg1() % reg2()) & WORD_MASK;
        this.registers[r1] = quotient;
        this.registers[r2] = remainder;
        this.setResultFlags(quotient);
        break;
      }
      case 0x18: this.cf = reg1() === reg2(); break;
      case 0x19: this.cf = reg1() > reg2(); break;
      case 0x1a: this.cf = reg1() < reg2(); break;
      case 0x1b: this.cf = reg1() >= reg2(); break;
      case 0x1c: this.cf = reg1() <= reg2(); break;
      case 0x1d: this.cf = !this.cf; break;
      case 0x1e: this.cf = true; break;
      case 0x1f: this.cf = false; break;
      case 0x20: this.cf = this.ov; break;
      case 0x21: this.cf = this.zf; break;
      case 0x22: this.cf = this.ca; break;
      case 0x23: this.pc = reg1(); jumped = true; break;
      case 0x24: if (this.cf) { this.pc = reg1(); jumped = true; } break;
      case 0x25: this.pc = (basePc + reg1()) & WORD_MASK; jumped = true; break;
      case 0x26: this.pc = (basePc - reg1()) & WORD_MASK; jumped = true; break;
      case 0x27: if (this.cf) { this.pc = (basePc + reg1()) & WORD_MASK; jumped = true; } break;
      case 0x28: if (this.cf) { this.pc = (basePc - reg1()) & WORD_MASK; jumped = true; } break;
      case 0x29: this.pc = (basePc + im) & WORD_MASK; jumped = true; break;
      case 0x2a: this.pc = (basePc - im) & WORD_MASK; jumped = true; break;
      case 0x2b: if (this.cf) { this.pc = (basePc + im) & WORD_MASK; jumped = true; } break;
      case 0x2c: if (this.cf) { this.pc = (basePc - im) & WORD_MASK; jumped = true; } break;
      case 0x2d: this.jsPush((basePc + size) & WORD_MASK); this.pc = reg1(); jumped = true; break;
      case 0x2e: if (this.cf) { this.jsPush((basePc + size) & WORD_MASK); this.pc = reg1(); jumped = true; } break;
      case 0x2f: this.pc = this.jsPop(); jumped = true; break;
      case 0x30: if (this.cf) { this.pc = this.jsPop(); jumped = true; } break;
      case 0x31: this.halted = true; break;
      case 0x32: this.handleInterrupt(reg1() & 0xff); jumped = true; break;
      case 0x33: this.handleInterrupt(im & 0xff); jumped = true; break;
      case 0x34: this.restoreContext(); this.iflag = false; jumped = true; break;
      case 0x35: this.bif = true; break;
      case 0x36: this.bif = false; break;
      case 0x37: this.pf = true; break;
      case 0x38: this.pf = false; break;
      case 0x39: this.localMemoryBegin = reg1(); break;
      case 0x3a: this.localMemoryEnd = reg1(); break;
      default:
        this.log(`Unknown opcode 0x${this.hex(opcode, 2)} @0x${this.hex(basePc)}`);
        this.halted = true;
        break;
    }

    if (!jumped && !this.halted) {
      this.pc = (basePc + size) & WORD_MASK;
    }

    this.log(`0x${this.hex(basePc)} ${meta.name}`);
    return { halted: this.halted, opcode, name: meta.name };
  }
}

const emulator = new Emulator();
let runTimer = null;
let initialized = false;

const RUN_INTERVAL_MS = 16;
const RUN_STEPS_PER_TICK = 40;

function renderState() {
  const regText = Array.from(emulator.registers)
    .map((value, idx) => `R${idx.toString(16).toUpperCase()}: 0x${emulator.hex(value)}`)
    .join("\n");
  const flagsText = `PC: 0x${emulator.hex(emulator.pc)}\nCF:${Number(emulator.cf)} PF:${Number(emulator.pf)} IF:${Number(emulator.iflag)} BIF:${Number(emulator.bif)}\nOV:${Number(emulator.ov)} CA:${Number(emulator.ca)} ZF:${Number(emulator.zf)}\nLMB:0x${emulator.hex(emulator.localMemoryBegin)} LME:0x${emulator.hex(emulator.localMemoryEnd)}`;
  const memoryStart = emulator.pc & 0xfff0;
  const memoryView = [];
  for (let row = 0; row < 4; row += 1) {
    const addr = (memoryStart + row * 8) & WORD_MASK;
    const bytes = [];
    for (let col = 0; col < 8; col += 1) {
      bytes.push(emulator.readByte(addr + col, true).toString(16).toUpperCase().padStart(2, "0"));
    }
    memoryView.push(`${emulator.hex(addr)}: ${bytes.join(" ")}`);
  }

  document.getElementById("emuRegisters").textContent = regText;
  document.getElementById("emuFlags").textContent = flagsText;
  document.getElementById("emuMemory").textContent = memoryView.join("\n");
  document.getElementById("emuLog").textContent = emulator.logs.join("\n");
  document.getElementById("emuTerminalOutput").textContent = emulator.terminalOutput || "[NO OUTPUT YET]";
}

function stopRunLoop() {
  if (runTimer) {
    window.clearInterval(runTimer);
    runTimer = null;
  }
}

function safeStep() {
  try {
    const result = emulator.step();
    renderState();
    if (result.halted) stopRunLoop();
  } catch (error) {
    emulator.log(`ERR: ${error.message}`);
    renderState();
    stopRunLoop();
  }
}

function runBurst() {
  try {
    for (let i = 0; i < RUN_STEPS_PER_TICK; i += 1) {
      const result = emulator.step();
      if (result.halted) {
        stopRunLoop();
        break;
      }
    }
    renderState();
  } catch (error) {
    emulator.log(`ERR: ${error.message}`);
    renderState();
    stopRunLoop();
  }
}

export function initEmulator() {
  if (initialized) {
    renderState();
    document.getElementById("emuTerminalInput")?.focus();
    return;
  }

  const loadBtn = document.getElementById("emuLoad");
  const assembleBtn = document.getElementById("emuAssemble");
  const stepBtn = document.getElementById("emuStep");
  const runBtn = document.getElementById("emuRun");
  const stopBtn = document.getElementById("emuStop");
  const resetBtn = document.getElementById("emuReset");
  const programInput = document.getElementById("emuProgram");
  const assemblyInput = document.getElementById("emuAssembly");
  const terminalInput = document.getElementById("emuTerminalInput");
  const terminalSendBtn = document.getElementById("emuTerminalSend");

  loadBtn.onclick = () => {
    try {
      emulator.loadProgram(programInput.value);
      renderState();
    } catch (error) {
      emulator.log(`Load error: ${error.message}`);
      renderState();
    }
  };


  assembleBtn.onclick = () => {
    try {
      const bytes = emulator.assembleProgram(assemblyInput.value);
      const hexProgram = emulator.bytesToHex(bytes);
      programInput.value = hexProgram;
      emulator.loadProgram(hexProgram);
      emulator.log(`Assembled ${bytes.length} bytes successfully.`);
      renderState();
    } catch (error) {
      emulator.log(`Assembler error: ${error.message}`);
      renderState();
    }
  };

  stepBtn.onclick = () => {
    stopRunLoop();
    safeStep();
  };

  runBtn.onclick = () => {
    if (runTimer) return;
    runTimer = window.setInterval(runBurst, RUN_INTERVAL_MS);
  };

  stopBtn.onclick = () => {
    stopRunLoop();
  };

  resetBtn.onclick = () => {
    stopRunLoop();
    emulator.reset();
    renderState();
  };

  terminalSendBtn.onclick = () => {
    const message = terminalInput.value.replace(/\r/g, "").trim();
    emulator.enqueueTerminalInput(message);
    terminalInput.value = "";
    terminalInput.focus();
    renderState();
  };

  terminalInput.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" || event.shiftKey) return;
    event.preventDefault();
    terminalSendBtn.click();
  });

  assemblyInput.value = `START:
  LFI R1, 0x0005
  LFI R2, 0x0003
  ADD R1, R2
  HALT`;
  const bootBytes = emulator.assembleProgram(assemblyInput.value);
  programInput.value = emulator.bytesToHex(bootBytes);
  emulator.loadProgram(programInput.value);
  renderState();
  terminalInput.focus();
  initialized = true;
}
