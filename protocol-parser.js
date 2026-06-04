(function exposeProtocolCodeParser(root) {
  const typeMap = new Map([
    ["uint8_t", "uint8"], ["uint8", "uint8"], ["byte", "uint8"], ["unsignedchar", "uint8"],
    ["int8_t", "int8"], ["int8", "int8"], ["char", "int8"], ["signedchar", "int8"],
    ["uint16_t", "uint16"], ["uint16", "uint16"], ["unsignedshort", "uint16"],
    ["int16_t", "int16"], ["int16", "int16"], ["short", "int16"], ["signedshort", "int16"],
    ["uint32_t", "uint32"], ["uint32", "uint32"], ["unsignedint", "uint32"], ["unsignedlong", "uint32"],
    ["int32_t", "int32"], ["int32", "int32"], ["int", "int32"], ["long", "int32"], ["signedint", "int32"],
    ["float", "float"],
  ]);

  const sendWords = /\b(tx|send|write|request|req|command|cmd|control|set)\b|发送|下发|控制|命令/i;
  const receiveWords = /\b(rx|recv|receive|read|response|resp|status|report|feedback|telemetry)\b|接收|上报|状态|反馈|遥测|解析/i;
  const sendNameWords = /(tx|send|write|request|req|command|cmd|control|set)|发送|下发|控制|命令/i;
  const receiveNameWords = /(rx|recv|receive|read|response|resp|status|report|feedback|telemetry)|接收|上报|状态|反馈|遥测|解析/i;

  function parse(source, options = {}) {
    const text = String(source || "").trim();
    if (!text) throw new Error("请先粘贴需要解析的协议代码");

    const groupName = String(options.groupName || "").trim() || `AI解析协议 ${new Date().toLocaleTimeString("zh-CN", { hour12: false })}`;
    const jsonResult = parseJsonProfile(text, groupName);
    if (jsonResult) return jsonResult;

    const packets = [];
    const parsers = [];
    const findings = [];
    const seen = new Set();

    for (const item of parseByteArrays(text)) {
      const direction = inferDirection(item.name, item.context);
      const packet = makeRawPacket(item.name, item.bytes);
      const parser = makeRawParser(item.name, item.bytes);
      addByDirection(direction, packet, parser, packets, parsers);
      findings.push(`${item.name}: 识别为 ${item.bytes.length} 字节数组，${directionLabel(direction)}`);
    }

    for (const item of parseIndexedAssignments(text)) {
      const direction = inferDirection(item.name, item.context);
      addByDirection(direction, makeAssignmentPacket(item), makeAssignmentParser(item), packets, parsers);
      findings.push(`${item.name}: 识别为 ${item.fields.length} 个索引赋值字段，${directionLabel(direction)}`);
    }

    for (const item of parseStructs(text)) {
      const key = `${item.name}:${item.body}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const direction = inferDirection(item.name, item.context);
      const fields = parseStructFields(item.body);
      if (!fields.length) continue;
      addByDirection(direction, makeStructPacket(item.name, fields), makeStructParser(item.name, fields), packets, parsers);
      findings.push(`${item.name}: 识别为 ${fields.length} 个字段的结构体，${directionLabel(direction)}`);
    }

    if (!packets.length && !parsers.length) {
      throw new Error("暂未识别到可导入内容。当前支持协议 JSON、C/C++ 结构体和 uint8_t/char 字节数组。");
    }

    return {
      profile: { groupName, protocolMode: "custom", packets, parsers },
      analysis: {
        sourceType: "C/C++ 协议代码",
        confidence: packets.length && parsers.length ? "高" : "中",
        findings,
        notes: [
          "方向无法确定的结构会同时生成发送包和接收规则，可在导入后删除不需要的一项。",
          "结构体默认按小端解析；固定帧头、校验范围和缩放公式建议导入后复核。",
        ],
      },
    };
  }

  function parseJsonProfile(text, groupName) {
    if (!/^[\[{]/.test(text)) return null;
    try {
      const data = JSON.parse(text);
      const candidate = Array.isArray(data) && data.length === 1 ? data[0] : data;
      if (!candidate?.packets || !candidate?.parsers) return null;
      const profile = structuredCloneSafe(candidate);
      profile.groupName = groupName || profile.groupName;
      profile.protocolMode ||= "custom";
      return {
        profile,
        analysis: {
          sourceType: "FTSerialTool 协议 JSON",
          confidence: "高",
          findings: [`识别到 ${profile.packets.length} 个发送包和 ${profile.parsers.length} 个接收规则`],
          notes: ["JSON 字段已按现有协议组格式直接导入。"],
        },
      };
    } catch {
      return null;
    }
  }

  function parseByteArrays(text) {
    const results = [];
    const pattern = /(?:const\s+)?(?:unsigned\s+char|uint8_t|byte|char)\s+(\w+)\s*\[\s*\d*\s*\]\s*=\s*\{([\s\S]*?)\}\s*;/gi;
    for (const match of text.matchAll(pattern)) {
      const bytes = [...match[2].matchAll(/0x([0-9a-f]{1,2})\b|\b(\d{1,3})\b/gi)]
        .map((value) => value[1] ? parseInt(value[1], 16) : Number(value[2]))
        .filter((value) => Number.isInteger(value) && value >= 0 && value <= 255);
      if (bytes.length) results.push({ name: match[1], bytes, context: nearbyText(text, match.index) });
    }
    return results;
  }

  function parseStructs(text) {
    const results = [];
    const typedefPattern = /typedef\s+struct(?:\s+\w+)?\s*\{([\s\S]*?)\}\s*(\w+)\s*;/gi;
    for (const match of text.matchAll(typedefPattern)) {
      results.push({ name: match[2], body: match[1], context: nearbyText(text, match.index) });
    }
    const namedPattern = /\bstruct\s+(\w+)\s*\{([\s\S]*?)\}\s*;/gi;
    for (const match of text.matchAll(namedPattern)) {
      results.push({ name: match[1], body: match[2], context: nearbyText(text, match.index) });
    }
    return results;
  }

  function parseStructFields(body) {
    const fields = [];
    const declaration = /(?:^|\n)[ \t]*(?:const\s+)?([^;{}\n]+?)\s+(\w+)\s*(?:\[\s*(\d+)\s*\])?\s*(?:=\s*([^,;]+))?\s*;[ \t]*(?:(?:\/\/[ \t]*([^\n]*))|(?:\/\*[ \t]*([\s\S]*?)\*\/))?/g;
    for (const match of body.matchAll(declaration)) {
      const type = mapType(match[1]);
      if (!type) continue;
      const count = Math.min(Math.max(Number(match[3]) || 1, 1), 64);
      const initial = parseNumeric(match[4]);
      const comment = String(match[5] || match[6] || "").trim();
      for (let index = 0; index < count; index++) {
        fields.push({
          type,
          name: count > 1 ? `${match[2]}[${index}]` : match[2],
          comment,
          value: initial ?? 0,
        });
      }
    }
    return fields;
  }

  function parseIndexedAssignments(text) {
    const groups = new Map();
    const assignment = /\b(\w+)\s*\[\s*(\d+)\s*\]\s*=\s*([^;]+);/g;
    for (const match of text.matchAll(assignment)) {
      const name = match[1];
      if (!groups.has(name)) groups.set(name, { name, fields: [], firstIndex: match.index });
      const numeric = parseNumeric(match[3].trim());
      groups.get(name).fields.push({
        index: Number(match[2]),
        name: numeric == null ? expressionName(match[3]) : `固定[${match[2]}]`,
        value: numeric ?? 0,
        fixed: numeric != null,
      });
    }
    return [...groups.values()]
      .filter((group) => group.fields.length >= 2)
      .map((group) => ({
        ...group,
        fields: group.fields.sort((a, b) => a.index - b.index),
        context: nearbyText(text, group.firstIndex),
      }));
  }

  function makeAssignmentPacket(item) {
    return {
      name: item.name,
      enabled: true,
      delay: 50,
      trigger: false,
      fields: item.fields.map((field) => field.fixed
        ? { type: "const", name: field.name, bytes: toHex([field.value]) }
        : { type: "uint8", name: field.name, value: 0, endian: "little", control: "number", min: 0, max: 255, step: 1 }),
    };
  }

  function makeAssignmentParser(item) {
    return {
      name: item.name,
      enabled: true,
      fields: item.fields.map((field) => field.fixed
        ? { type: "const", name: field.name, bytes: toHex([field.value]), show: false, curve: false }
        : { type: "uint8", name: field.name, endian: "little", show: true, curve: false, widget: "metric", expr: "x" }),
    };
  }

  function mapType(value) {
    const normalized = value.replace(/\b(const|volatile|static|register)\b/g, "").replace(/\s+/g, "").toLowerCase();
    return typeMap.get(normalized) || null;
  }

  function parseNumeric(value) {
    if (!value) return null;
    const match = String(value).trim().match(/^-?(?:0x[0-9a-f]+|\d+(?:\.\d+)?)$/i);
    return match ? Number(match[0]) : null;
  }

  function expressionName(value) {
    const identifiers = String(value).match(/[A-Za-z_]\w*/g) || [];
    return identifiers.find((name) => !["uint8_t", "char", "byte"].includes(name)) || "数据";
  }

  function makeStructPacket(name, fields) {
    return {
      name,
      enabled: true,
      delay: 50,
      trigger: false,
      fields: fields.map((field) => {
        const special = specialField(field);
        if (special) return special;
        const limits = typeLimits(field.type);
        return {
          type: field.type,
          name: displayName(field),
          value: field.value,
          endian: "little",
          control: "number",
          min: limits.min,
          max: limits.max,
          step: field.type === "float" ? 0.1 : 1,
        };
      }),
    };
  }

  function makeStructParser(name, fields) {
    return {
      name,
      enabled: true,
      fields: fields.map((field) => {
        const special = specialField(field, true);
        if (special) return special;
        return {
          type: field.type,
          name: displayName(field),
          endian: "little",
          show: true,
          curve: false,
          widget: "metric",
          expr: "x",
        };
      }),
    };
  }

  function specialField(field, parser = false) {
    const name = `${field.name} ${field.comment}`.toLowerCase();
    if (/\bcrc16\b/.test(name)) {
      if (parser) return { type: "uint16", name: displayName(field), endian: "little", show: false, curve: false, expr: "x" };
      return { type: "crc16", name: displayName(field), rangeStart: 0, rangeEnd: 0 };
    }
    if (/\b(checksum|sum8|check)\b|校验/.test(name)) {
      return { type: "checksum8", name: displayName(field), rangeStart: 0, rangeEnd: 0, ...(parser ? { show: false, curve: false } : {}) };
    }
    return null;
  }

  function makeRawPacket(name, bytes) {
    return {
      name,
      enabled: true,
      delay: 50,
      trigger: false,
      fields: [{ type: "const", name: "固定数据", bytes: toHex(bytes) }],
    };
  }

  function makeRawParser(name, bytes) {
    return {
      name,
      enabled: true,
      fields: [{ type: "const", name: "固定数据", bytes: toHex(bytes), show: false, curve: false }],
    };
  }

  function addByDirection(direction, packet, parser, packets, parsers) {
    if (direction !== "receive") packets.push(packet);
    if (direction !== "send") parsers.push(parser);
  }

  function inferDirection(name, context) {
    const nameSend = sendNameWords.test(name);
    const nameReceive = receiveNameWords.test(name);
    if (nameSend && !nameReceive) return "send";
    if (nameReceive && !nameSend) return "receive";
    const send = sendWords.test(context);
    const receive = receiveWords.test(context);
    if (send && !receive) return "send";
    if (receive && !send) return "receive";
    return "both";
  }

  function directionLabel(direction) {
    if (direction === "send") return "判断为发送包";
    if (direction === "receive") return "判断为接收规则";
    return "方向不明确，生成发送包与接收规则";
  }

  function displayName(field) {
    return field.comment || field.name;
  }

  function nearbyText(text, index) {
    return text.slice(Math.max(0, index - 180), index + 80);
  }

  function typeLimits(type) {
    if (type === "uint8") return { min: 0, max: 255 };
    if (type === "int8") return { min: -128, max: 127 };
    if (type === "uint16") return { min: 0, max: 65535 };
    if (type === "int16") return { min: -32768, max: 32767 };
    if (type === "uint32") return { min: 0, max: 4294967295 };
    if (type === "int32") return { min: -2147483648, max: 2147483647 };
    return { min: -1000000, max: 1000000 };
  }

  function toHex(bytes) {
    return bytes.map((value) => value.toString(16).padStart(2, "0").toUpperCase()).join(" ");
  }

  function structuredCloneSafe(value) {
    return typeof structuredClone === "function" ? structuredClone(value) : JSON.parse(JSON.stringify(value));
  }

  const api = { parse };
  root.ProtocolCodeParser = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
