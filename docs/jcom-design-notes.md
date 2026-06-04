# JCom Design Notes

Reference page: https://jooiee.com/cms/ruanjian/115.html

Local reference files:

- `C:\Users\shuow\Desktop\JCom.exe`
- `C:\Users\shuow\Desktop\JComDATA\*.port`

## Product Positioning

JCom is positioned as a serial debugging tool optimized for protocol-based motor/device testing:

- standard serial send/receive and terminal mode
- custom packet send builder
- custom receive parser
- parsed value dashboard
- high-performance multi-channel realtime curves
- import/exportable protocol groups for repeated test workflows

The important design idea is that it is not only a "serial terminal". It turns a binary/text protocol into a small control panel and telemetry dashboard.

## Main Window Layout

The default UI uses a dense engineering-tool layout:

- top connection bar: COM port, baud rate, open/close button, settings/help/terminal mode
- large receive area in the center
- narrow vertical receive toolbar on the left
- bottom send area with send/clear buttons and cycle-send options
- right/top switches for realtime mode, cache behavior, HEX display, and expanded panels

This layout keeps common serial tasks one click away without a landing page or wizard.

## Packet Send Design

The packet-send feature is the strongest part to learn from:

- packet groups can contain init-send and cycle-send lists
- each row has name, enable/check state, delay, trigger-send, HEX/text mode, and packet bytes
- binary packets are built from ordered fields instead of one raw string
- field types include frame head, frame ID, payload/data, checksum, length, and tail
- editable fields can generate controls such as sliders, switches, and enum/radio controls
- changing a generated control can update packet bytes and optionally trigger immediate send
- checksum fields auto-update from a selected byte range
- CRC/checksum options are configurable, including custom CRC parameters

For FTSerialTool, this suggests modeling packets as structured fields first, then rendering both raw bytes and control widgets from that model.

## Receive Parser Design

The receive parser mirrors the send builder:

- multiple frame definitions can parse in parallel
- each definition has ordered fields with type, length, endian, and expected bytes
- payload fields can be converted into Int, UInt, Float, Double, etc.
- each field can have a display name, panel visibility, curve visibility, and expression
- formulas allow post-processing, for example `Truncate([x]/32767*8000)`
- parsed values update a dashboard tile/table area
- indicator lights show recent successful updates
- sequence/frame-number fields can be used for packet-loss detection

The key lesson is symmetry: the same mental model, "frame = ordered fields", is used for both send and receive.

## Realtime Curve Design

JCom treats curves as a first-class testing view:

- parsed values can be sent to curves directly from the data panel
- multiple channels render in one curve window
- channels can also be separated into individual tracks
- pause mode supports zoom, pan, cursor value inspection, and scrollback
- large buffers allow viewing previous data
- realtime data can be cached to CSV logs for long tests

For motor/pump testing, this is more valuable than a plain receive log because engineers often need speed/current/voltage trends while adjusting commands.

## Terminal Mode

Terminal mode is a separate native-console style view for command-line devices:

- one-click switch from tool mode to terminal mode
- optional auto-terminal behavior after opening the port
- configurable console colors and transparency

This keeps command-line workflows available without forcing them into the packet/debug dashboard.

## Observed `.port` Data Model

The saved project files are JSON arrays. Important top-level fields observed:

- `GroupName`
- `InitSendList`
- `CycleSendList`
- `RecvHexList`
- `RecvTxtList`

Send packet entries include:

- `Number`
- `Checked`
- `Delay`
- `PacketName`
- `HexMode`
- `HexByteData`
- `Enable`
- `Trigger`
- `TxtData`
- `TailType`
- `hexFieldContent`

Field entries include:

- `HexType`
- `CntLimit`
- `IsBigEndian`
- `HexData`
- `CreateControl`
- `DataConvert`
- `Check`
- `MsgLen`
- `PanelShow`

This is a useful schema reference if FTSerialTool needs project import/export.

## Design Takeaways For FTSerialTool

- Use a compact, workbench-style UI: connection controls, receive log, send panel, and parse/dashboard panels should be visible together.
- Make protocol configuration reusable through named groups/files.
- Represent packets as structured fields, not only raw HEX strings.
- Let send fields become live controls, especially sliders for motor speed/current/voltage commands.
- Let receive fields become dashboard metrics and curve channels.
- Keep checksum/CRC/length fields automatic so users do not manually recalculate bytes.
- Provide fast toggles for HEX display, realtime pause, caching/logging, and expanded parser/dashboard mode.
- Keep terminal mode separate but easy to enter.
