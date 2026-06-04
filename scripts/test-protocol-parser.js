const assert = require("node:assert/strict");
const parser = require("../protocol-parser.js");

const source = `
typedef struct {
  uint8_t command;
  int16_t targetSpeed;
  uint16_t crc16;
} MotorTxCommand;

typedef struct {
  uint8_t status;
  int16_t actualSpeed;
  float current;
} MotorRxStatus;

const uint8_t stop_cmd[] = {0xAA, 0x01, 0x00, 0xAB};
`;

const result = parser.parse(source, { groupName: "Parser Test" });
assert.equal(result.profile.groupName, "Parser Test");
assert.deepEqual(result.profile.packets.map((item) => item.name), ["stop_cmd", "MotorTxCommand"]);
assert.deepEqual(result.profile.parsers.map((item) => item.name), ["MotorRxStatus"]);
assert.equal(result.profile.packets[1].fields[1].type, "int16");
assert.equal(result.profile.parsers[0].fields[2].type, "float");
assert.equal(result.profile.packets[1].fields[1].name, "targetSpeed");

const assignmentResult = parser.parse(`
  uint8_t txBuffer[3];
  txBuffer[0] = 0xAA;
  txBuffer[1] = command;
  txBuffer[2] = speed;
`, { groupName: "Assignment Test" });
assert.equal(assignmentResult.profile.packets[0].fields.length, 3);
assert.equal(assignmentResult.profile.packets[0].fields[0].type, "const");
assert.equal(assignmentResult.profile.packets[0].fields[1].name, "command");

console.log("Protocol parser tests passed.");
